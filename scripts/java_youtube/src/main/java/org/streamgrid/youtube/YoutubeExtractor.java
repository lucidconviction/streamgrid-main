package org.streamgrid.youtube;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import org.schabi.newpipe.extractor.Image;
import org.schabi.newpipe.extractor.Info;
import org.schabi.newpipe.extractor.InfoItem;
import org.schabi.newpipe.extractor.NewPipe;
import org.schabi.newpipe.extractor.Page;
import org.schabi.newpipe.extractor.ServiceList;
import org.schabi.newpipe.extractor.channel.ChannelExtractor;
import org.schabi.newpipe.extractor.channel.tabs.ChannelTabExtractor;
import org.schabi.newpipe.extractor.comments.CommentsExtractor;
import org.schabi.newpipe.extractor.comments.CommentsInfoItem;
import org.schabi.newpipe.extractor.downloader.Downloader;
import org.schabi.newpipe.extractor.downloader.Request;
import org.schabi.newpipe.extractor.downloader.Response;
import org.schabi.newpipe.extractor.exceptions.ExtractionException;
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException;
import org.schabi.newpipe.extractor.kiosk.KioskExtractor;
import org.schabi.newpipe.extractor.kiosk.KioskList;
import org.schabi.newpipe.extractor.linkhandler.ListLinkHandler;
import org.schabi.newpipe.extractor.linkhandler.LinkHandler;
import org.schabi.newpipe.extractor.linkhandler.SearchQueryHandler;
import org.schabi.newpipe.extractor.localization.Localization;
import org.schabi.newpipe.extractor.playlist.PlaylistExtractor;
import org.schabi.newpipe.extractor.search.SearchExtractor;
import org.schabi.newpipe.extractor.services.youtube.YoutubeService;
import org.schabi.newpipe.extractor.services.youtube.linkHandler.YoutubeChannelLinkHandlerFactory;
import org.schabi.newpipe.extractor.services.youtube.linkHandler.YoutubeCommentsLinkHandlerFactory;
import org.schabi.newpipe.extractor.services.youtube.linkHandler.YoutubePlaylistLinkHandlerFactory;
import org.schabi.newpipe.extractor.services.youtube.linkHandler.YoutubeSearchQueryHandlerFactory;
import org.schabi.newpipe.extractor.services.youtube.linkHandler.YoutubeStreamLinkHandlerFactory;
import org.schabi.newpipe.extractor.services.youtube.extractors.YoutubeChannelExtractor;
import org.schabi.newpipe.extractor.services.youtube.extractors.YoutubeCommentsExtractor;
import org.schabi.newpipe.extractor.services.youtube.extractors.YoutubePlaylistExtractor;
import org.schabi.newpipe.extractor.services.youtube.extractors.YoutubeStreamExtractor;
import org.schabi.newpipe.extractor.services.youtube.extractors.kiosk.YoutubeLiveExtractor;
import org.schabi.newpipe.extractor.services.youtube.extractors.kiosk.YoutubeTrendingExtractor;
import org.schabi.newpipe.extractor.stream.StreamExtractor;
import org.schabi.newpipe.extractor.stream.StreamInfoItem;
import org.schabi.newpipe.extractor.stream.StreamType;
import org.schabi.newpipe.extractor.stream.ContentAvailability;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.TimeUnit;

import okhttp3.ConnectionSpec;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.RequestBody;

/**
 * YouTube Stream Hub — NewPipeExtractor CLI.
 * Commands: stream, channel, playlist, search, trending, live, comments
 */
public class YoutubeExtractor {

    static final String USER_AGENT =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" +
            " (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

    static class HttpDownloader extends Downloader {
        private final OkHttpClient client;

        HttpDownloader() {
            this.client = new OkHttpClient.Builder()
                    .readTimeout(30, TimeUnit.SECONDS)
                    .connectTimeout(30, TimeUnit.SECONDS)
                    .connectionSpecs(List.of(ConnectionSpec.RESTRICTED_TLS))
                    .build();
        }

        @Override
        public Response execute(Request request) throws IOException, ReCaptchaException {
            okhttp3.Request.Builder okBuilder = new okhttp3.Request.Builder()
                    .url(request.url())
                    .addHeader("User-Agent", USER_AGENT);

            byte[] dataToSend = request.dataToSend();
            if (dataToSend != null) {
                okBuilder.method(request.httpMethod(),
                        RequestBody.create(dataToSend, MediaType.get("application/octet-stream")));
            } else {
                okBuilder.method(request.httpMethod(), null);
            }

            if (request.headers() != null) {
                request.headers().forEach((name, values) -> {
                    okBuilder.removeHeader(name);
                    for (String v : values) okBuilder.addHeader(name, v);
                });
            }

            try (okhttp3.Response response = client.newCall(okBuilder.build()).execute()) {
                if (response.code() == 429) {
                    throw new ReCaptchaException("reCaptcha Challenge requested", request.url());
                }
                String body = response.body() != null ? response.body().string() : null;
                return new Response(response.code(), response.message(),
                        response.headers().toMultimap(), body, response.request().url().toString());
            }
        }

        @Override
        public Downloader clone() { return new HttpDownloader(); }
    }

    static final Gson GSON = new Gson();
    static final YoutubeService YOUTUBE_SERVICE = ServiceList.YouTube;

    // ─── Helpers ────────────────────────────────────────────────────────────────

    static void init() {
        NewPipe.init(new HttpDownloader(), new Localization("en", "US"));
    }

    static JsonObject error(String msg) {
        JsonObject e = new JsonObject();
        e.addProperty("error", msg);
        return e;
    }

    static JsonArray serializeImages(List<Image> images) {
        JsonArray arr = new JsonArray();
        if (images == null) return arr;
        for (Image img : images) {
            JsonObject o = new JsonObject();
            o.addProperty("url", img.getUrl());
            o.addProperty("width", img.getWidth());
            o.addProperty("height", img.getHeight());
            arr.add(o);
        }
        return arr;
    }

    static String statusFromType(StreamType type, ContentAvailability avail, boolean isShort) {
        if (isShort) return "shorts";
        if (type == StreamType.LIVE_STREAM || type == StreamType.AUDIO_LIVE_STREAM
                || type == StreamType.POST_LIVE_STREAM || type == StreamType.POST_LIVE_AUDIO_STREAM) {
            return "live";
        }
        if (avail == ContentAvailability.UPCOMING) return "upcoming";
        return "vod";
    }

    static JsonObject streamInfoToJsonObject(StreamExtractor ex) {
        JsonObject obj = new JsonObject();
        try {
            obj.addProperty("id", ex.getId());
            obj.addProperty("title", ex.getName());
            obj.addProperty("description", ex.getDescription().getContent());
            obj.addProperty("durationSeconds", ex.getLength());
            obj.addProperty("viewCount", ex.getViewCount());
            obj.addProperty("likeCount", ex.getLikeCount());
            obj.addProperty("dislikeCount", ex.getDislikeCount());
            obj.addProperty("uploadDate", ex.getTextualUploadDate());
            obj.addProperty("category", ex.getCategory());
            obj.addProperty("isShortFormContent", ex.isShortFormContent());

            JsonArray tags = new JsonArray();
            for (String t : ex.getTags()) tags.add(t);
            obj.add("tags", tags);

            obj.add("thumbnails", serializeImages(ex.getThumbnails()));
            obj.addProperty("hlsUrl", ex.getHlsUrl() != null ? ex.getHlsUrl() : "");
            obj.addProperty("dashMpdUrl", ex.getDashMpdUrl() != null ? ex.getDashMpdUrl() : "");
            obj.addProperty("streamType", ex.getStreamType().name());
            obj.addProperty("contentAvailability", ex.getContentAvailability().name());
            obj.addProperty("status",
                    statusFromType(ex.getStreamType(), ex.getContentAvailability(), ex.isShortFormContent()));
            obj.addProperty("embedUrl", "https://www.youtube.com/embed/" + ex.getId());
            obj.addProperty("url", "https://www.youtube.com/watch?v=" + ex.getId());

            JsonObject ch = new JsonObject();
            ch.addProperty("id", ex.getUploaderUrl());
            ch.addProperty("name", ex.getUploaderName());
            ch.addProperty("verified", ex.isUploaderVerified());
            ch.addProperty("subscriberCount", ex.getUploaderSubscriberCount());
            ch.add("avatars", serializeImages(ex.getUploaderAvatars()));
            obj.add("channel", ch);
        } catch (Exception e) {
            obj.addProperty("parseError", e.getMessage());
        }
        return obj;
    }

    static JsonObject itemToJsonObject(StreamInfoItem item) {
        JsonObject obj = new JsonObject();
        try {
            obj.addProperty("id", item.getUrl());
            obj.addProperty("title", item.getName());
            obj.addProperty("durationSeconds", item.getDuration());
            obj.addProperty("viewCount", item.getViewCount());
            obj.addProperty("uploadDate", item.getTextualUploadDate());
            obj.addProperty("isShortFormContent", item.isShortFormContent());
            obj.addProperty("uploaderName", item.getUploaderName());
            obj.addProperty("uploaderUrl", item.getUploaderUrl());
            obj.add("uploaderAvatars", serializeImages(item.getUploaderAvatars()));
            obj.add("thumbnails", serializeImages(item.getThumbnails()));
            obj.addProperty("status",
                    item.isShortFormContent() ? "shorts" : "vod");
        } catch (Exception e) {
            obj.addProperty("parseError", e.getMessage());
        }
        return obj;
    }

    static JsonObject commentToJsonObject(CommentsInfoItem item) {
        JsonObject obj = new JsonObject();
        try {
            obj.addProperty("id", item.getCommentId());
            obj.addProperty("text", item.getCommentText() != null ? item.getCommentText().getContent() : "");
            obj.addProperty("authorName", item.getUploaderName());
            obj.addProperty("authorUrl", item.getUploaderUrl());
            obj.add("authorAvatar", serializeImages(item.getUploaderAvatars()));
            obj.addProperty("publishedAt", item.getTextualUploadDate());
            obj.addProperty("likeCount", item.getLikeCount());
            obj.addProperty("replyCount", item.getReplyCount());
            obj.addProperty("isLikedByUploader", item.hasCreatorReply());
        } catch (Exception e) {
            obj.addProperty("parseError", e.getMessage());
        }
        return obj;
    }

    // ─── Commands ───────────────────────────────────────────────────────────────

    static JsonObject cmdStream(String videoId) {
        try {
            String url = "https://www.youtube.com/watch?v=" + videoId;
            LinkHandler lh = YoutubeStreamLinkHandlerFactory.getInstance().fromUrl(url);
            StreamExtractor ex = YOUTUBE_SERVICE.getStreamExtractor(lh);
            ex.fetchPage();
            return streamInfoToJsonObject(ex);
        } catch (Exception e) {
            return error("stream: " + e.getMessage());
        }
    }

    static JsonObject cmdChannel(String channelId) {
        try {
            String url = "https://www.youtube.com/channel/" + channelId;
            ListLinkHandler lh = YoutubeChannelLinkHandlerFactory.getInstance().fromUrl(url);
            ChannelExtractor ex = YOUTUBE_SERVICE.getChannelExtractor(lh);
            ex.fetchPage();
            JsonObject obj = new JsonObject();
            obj.addProperty("id", channelId);
            obj.addProperty("name", ex.getName());
            obj.addProperty("url", url);
            obj.addProperty("description", ex.getDescription());
            obj.addProperty("verified", ex.isVerified());
            obj.addProperty("subscriberCount", ex.getSubscriberCount());
            obj.add("avatars", serializeImages(ex.getAvatars()));
            obj.add("banners", serializeImages(ex.getBanners()));

            // Fetch recent videos from the first tab (usually "Videos")
            JsonArray videos = new JsonArray();
            try {
                List<ListLinkHandler> tabs = ex.getTabs();
                if (tabs != null && !tabs.isEmpty()) {
                    ChannelTabExtractor tabEx = YOUTUBE_SERVICE.getChannelTabExtractor(tabs.get(0));
                    tabEx.fetchPage();
                    for (InfoItem ii : tabEx.getInitialPage().getItems()) {
                        if (ii instanceof StreamInfoItem) {
                            videos.add(itemToJsonObject((StreamInfoItem) ii));
                        }
                        if (videos.size() >= 15) break;
                    }
                }
            } catch (Exception ignored) {}
            obj.add("videos", videos);
            return obj;
        } catch (Exception e) {
            return error("channel: " + e.getMessage());
        }
    }

    static JsonObject cmdPlaylist(String playlistId) {
        try {
            String url = "https://www.youtube.com/playlist?list=" + playlistId;
            ListLinkHandler lh = YoutubePlaylistLinkHandlerFactory.getInstance().fromUrl(url);
            PlaylistExtractor ex = YOUTUBE_SERVICE.getPlaylistExtractor(lh);
            ex.fetchPage();
            JsonObject obj = new JsonObject();
            obj.addProperty("id", playlistId);
            obj.addProperty("title", ex.getName());
            obj.addProperty("description", ex.getDescription().getContent());
            obj.addProperty("videoCount", ex.getStreamCount());
            obj.add("thumbnails", serializeImages(ex.getThumbnails()));
            obj.addProperty("uploaderName", ex.getUploaderName());
            obj.addProperty("uploaderUrl", ex.getUploaderUrl());
            JsonArray items = new JsonArray();
            for (StreamInfoItem si : ex.getInitialPage().getItems()) {
                items.add(itemToJsonObject(si));
            }
            obj.add("items", items);
            return obj;
        } catch (Exception e) {
            return error("playlist: " + e.getMessage());
        }
    }

    static JsonObject cmdSearch(String query, int limit) {
        try {
            SearchQueryHandler sqh = YOUTUBE_SERVICE.getSearchQHFactory().fromQuery(query);
            SearchExtractor ex = YOUTUBE_SERVICE.getSearchExtractor(sqh);
            ex.fetchPage();
            JsonArray results = new JsonArray();
            int count = 0;
            for (InfoItem item : ex.getInitialPage().getItems()) {
                if (!(item instanceof StreamInfoItem)) continue;
                results.add(itemToJsonObject((StreamInfoItem) item));
                count++;
                if (count >= limit) break;
            }
            JsonObject obj = new JsonObject();
            obj.addProperty("query", query);
            obj.add("results", results);
            return obj;
        } catch (Exception e) {
            return error("search: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    static JsonObject cmdTrending() {
        try {
            KioskList kioskList = YOUTUBE_SERVICE.getKioskList();
            KioskExtractor extractor = kioskList.getExtractorById("Trending", new Page("https://www.youtube.com"));
            extractor.fetchPage();
            JsonArray items = new JsonArray();
            for (Object ii : extractor.getInitialPage().getItems()) {
                if (ii instanceof StreamInfoItem) {
                    items.add(itemToJsonObject((StreamInfoItem) ii));
                }
            }
            JsonObject obj = new JsonObject();
            obj.addProperty("kiosk", "trending");
            obj.add("items", items);
            return obj;
        } catch (Exception e) {
            return error("trending: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    static JsonObject cmdLive() {
        try {
            KioskList kioskList = YOUTUBE_SERVICE.getKioskList();
            KioskExtractor extractor = kioskList.getExtractorById("live", new Page("https://www.youtube.com"));
            extractor.fetchPage();
            JsonArray items = new JsonArray();
            for (Object ii : extractor.getInitialPage().getItems()) {
                if (ii instanceof StreamInfoItem) {
                    items.add(itemToJsonObject((StreamInfoItem) ii));
                }
            }
            JsonObject obj = new JsonObject();
            obj.addProperty("kiosk", "live");
            obj.add("items", items);
            return obj;
        } catch (Exception e) {
            return error("live: " + e.getMessage());
        }
    }

    static JsonObject cmdComments(String videoId, int limit) {
        try {
            String url = "https://www.youtube.com/watch?v=" + videoId;
            ListLinkHandler lh = YoutubeCommentsLinkHandlerFactory.getInstance().fromUrl(url);
            CommentsExtractor ex = YOUTUBE_SERVICE.getCommentsExtractor(lh);
            ex.fetchPage();
            JsonArray comments = new JsonArray();
            int count = 0;
            for (InfoItem item : ex.getInitialPage().getItems()) {
                if (!(item instanceof CommentsInfoItem)) continue;
                comments.add(commentToJsonObject((CommentsInfoItem) item));
                count++;
                if (count >= limit) break;
            }
            JsonObject obj = new JsonObject();
            obj.addProperty("videoId", videoId);
            obj.add("comments", comments);
            return obj;
        } catch (Exception e) {
            return error("comments: " + e.getMessage());
        }
    }

    // ─── Main ───────────────────────────────────────────────────────────────────

    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("Usage: YoutubeExtractor <command> [args...]");
            System.err.println("  stream <videoId>          — full stream info");
            System.err.println("  channel <channelId>        — channel info + recent videos");
            System.err.println("  playlist <playlistId>      — playlist info + items");
            System.err.println("  search <query> [limit]     — search YouTube (default 10)");
            System.err.println("  trending                   — trending streams");
            System.err.println("  live                       — live streams");
            System.err.println("  comments <videoId> [limit] — comments (default 20)");
            System.exit(1);
        }

        String command = args[0];
        JsonObject result;

        try {
            init();
        } catch (Exception e) {
            System.out.println(GSON.toJson(error("init: " + e.getMessage())));
            System.exit(1);
        }

        switch (command) {
            case "stream" -> {
                if (args.length < 2) { System.err.println("Missing videoId"); System.exit(1); }
                result = cmdStream(args[1]);
            }
            case "channel" -> {
                if (args.length < 2) { System.err.println("Missing channelId"); System.exit(1); }
                result = cmdChannel(args[1]);
            }
            case "playlist" -> {
                if (args.length < 2) { System.err.println("Missing playlistId"); System.exit(1); }
                result = cmdPlaylist(args[1]);
            }
            case "search" -> {
                if (args.length < 2) { System.err.println("Missing query"); System.exit(1); }
                int limit = args.length >= 3 ? Integer.parseInt(args[2]) : 10;
                result = cmdSearch(args[1], limit);
            }
            case "trending" -> result = cmdTrending();
            case "live" -> result = cmdLive();
            case "comments" -> {
                if (args.length < 2) { System.err.println("Missing videoId"); System.exit(1); }
                int limit = args.length >= 3 ? Integer.parseInt(args[2]) : 20;
                result = cmdComments(args[1], limit);
            }
            default -> {
                System.err.println("Unknown command: " + command);
                System.exit(1);
                return;
            }
        }

        System.out.println(GSON.toJson(result));
    }
}
