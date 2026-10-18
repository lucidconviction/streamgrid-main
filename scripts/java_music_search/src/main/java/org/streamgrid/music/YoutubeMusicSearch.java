package org.streamgrid.music;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import org.schabi.newpipe.extractor.InfoItem;
import org.schabi.newpipe.extractor.ListExtractor.InfoItemsPage;
import org.schabi.newpipe.extractor.NewPipe;
import org.schabi.newpipe.extractor.ServiceList;
import org.schabi.newpipe.extractor.channel.ChannelInfoItem;
import org.schabi.newpipe.extractor.exceptions.ExtractionException;
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException;
import org.schabi.newpipe.extractor.localization.Localization;
import org.schabi.newpipe.extractor.services.youtube.YoutubeService;
import org.schabi.newpipe.extractor.services.youtube.extractors.YoutubeMusicSearchExtractor;
import org.schabi.newpipe.extractor.linkhandler.SearchQueryHandler;
import org.schabi.newpipe.extractor.downloader.Downloader;
import org.schabi.newpipe.extractor.downloader.Request;
import org.schabi.newpipe.extractor.downloader.Response;
import org.schabi.newpipe.extractor.stream.StreamInfoItem;

import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

import okhttp3.ConnectionSpec;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.RequestBody;

public class YoutubeMusicSearch {

    // Strict patterns to filter out non-artists
    private static final Pattern EXCLUDE_PATTERN = Pattern.compile(
            "(?i)(playlist|mix|compilation|greatest hits|collection|fanpage|fan page|tribute|cover|covers|" +
            "radio|top hits|best of|music box|music world|tv|network|station|hub|zone|" +
            "lofi|chill|relax|study|sleep|instrumental|piano|guitar|classical|jazz|" +
            "background|ambient|noise|white noise|lounge|cafe|bar|coffee|restaurant|" +
            "vip|3d|8d|bass boosted|karaoke|lyrics|loop|fade|continuous|" +
            "gta|minecraft|roblox|fortnite|gaming|edm|trance|house music|techno|dj|" +
            "sleepy|rain melody|chill beats|study music)")
    ;

    static class HttpDownloader extends Downloader {
        private static final String USER_AGENT =
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

        private final OkHttpClient client;

        public HttpDownloader() {
            this.client = new OkHttpClient.Builder()
                    .readTimeout(30, TimeUnit.SECONDS)
                    .connectTimeout(30, TimeUnit.SECONDS)
                    .connectionSpecs(List.of(ConnectionSpec.RESTRICTED_TLS))
                    .build();
        }

        @Override
        public Response execute(Request request) throws IOException, ReCaptchaException {
            String httpMethod = request.httpMethod();
            String url = request.url();
            Map<String, List<String>> headers = request.headers();
            byte[] dataToSend = request.dataToSend();

            RequestBody requestBody = null;
            if (dataToSend != null) {
                requestBody = RequestBody.create(dataToSend, MediaType.get("application/octet-stream"));
            }

            okhttp3.Request.Builder okBuilder = new okhttp3.Request.Builder()
                    .method(httpMethod, requestBody)
                    .url(url)
                    .addHeader("User-Agent", USER_AGENT);

            if (headers != null) {
                headers.forEach((name, values) -> {
                    okBuilder.removeHeader(name);
                    for (String value : values) {
                        okBuilder.addHeader(name, value);
                    }
                });
            }

            try (okhttp3.Response response = client.newCall(okBuilder.build()).execute()) {
                if (response.code() == 429) {
                    throw new ReCaptchaException("reCaptcha Challenge requested", url);
                }

                String responseBody = null;
                try (okhttp3.ResponseBody body = response.body()) {
                    if (body != null) {
                        responseBody = body.string();
                    }
                }

                return new Response(
                        response.code(),
                        response.message(),
                        response.headers().toMultimap(),
                        responseBody,
                        response.request().url().toString());
            }
        }

        @Override
        public Downloader clone() {
            return new HttpDownloader();
        }
    }

    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("Usage: YoutubeMusicSearch <search|tracks|top100> [query] [limit]");
            System.exit(1);
        }

        String command = args[0];
        String query = args.length > 1 ? args[1] : "";
        int limit = args.length > 2 ? Integer.parseInt(args[2]) : 10;

        try {
            NewPipe.init(new HttpDownloader(),
                    new Localization("en", "US"));

            YoutubeService service = ServiceList.YouTube;

            if (command.equals("search")) {
                searchArtists(service, query, limit);
            } else if (command.equals("tracks")) {
                getArtistInfo(service, query, limit);
            } else if (command.equals("top100")) {
                getTop100Artists(service, limit);
            } else {
                System.err.println("Unknown command: " + command);
                System.exit(1);
            }
        } catch (Exception e) {
            JsonObject result = new JsonObject();
            result.addProperty("error", e.getMessage());
            System.out.println(new Gson().toJson(result));
            System.exit(1);
        }
    }

    static boolean isLikelyArtist(String name) {
        if (name == null || name.length() < 2) return false;
        String lower = name.toLowerCase();
        // Must not match exclude patterns
        if (EXCLUDE_PATTERN.matcher(lower).find()) return false;
        // Must have at least one letter
        if (!lower.matches(".*[a-z].*")) return false;
        return true;
    }

    static void searchArtists(YoutubeService service, String query, int limit) throws Exception {
        String encodedQuery = query.replace(" ", "+");
        SearchQueryHandler handler = new SearchQueryHandler(
                "https://music.youtube.com/search?q=" + encodedQuery,
                "https://music.youtube.com/search?q=" + encodedQuery,
                query,
                Collections.singletonList("music_artists"),
                null);
        YoutubeMusicSearchExtractor extractor = new YoutubeMusicSearchExtractor(service, handler);

        extractor.fetchPage();
        InfoItemsPage<InfoItem> page = extractor.getInitialPage();
        List<InfoItem> items = page.getItems();

        JsonArray artists = new JsonArray();
        for (InfoItem item : items) {
            if (item instanceof ChannelInfoItem) {
                ChannelInfoItem channel = (ChannelInfoItem) item;
                String name = channel.getName();
                // Filter to only likely artists
                if (!isLikelyArtist(name)) continue;

                JsonObject artist = new JsonObject();
                artist.addProperty("name", name);
                artist.addProperty("channel_id", extractChannelId(channel.getUrl()));
                if (!channel.getThumbnails().isEmpty()) {
                    artist.addProperty("thumbnail", channel.getThumbnails().get(0).getUrl());
                }
                artists.add(artist);
            }
            if (artists.size() >= limit) break;
        }

        JsonObject result = new JsonObject();
        result.add("artists", artists);
        System.out.println(new Gson().toJson(result));
    }

    static void getArtistInfo(YoutubeService service, String query, int limit) throws Exception {
        String encodedQuery = query.replace(" ", "+");
        SearchQueryHandler handler = new SearchQueryHandler(
                "https://music.youtube.com/search?q=" + encodedQuery,
                "https://music.youtube.com/search?q=" + encodedQuery,
                query,
                Collections.singletonList("music_artists"),
                null);
        YoutubeMusicSearchExtractor extractor = new YoutubeMusicSearchExtractor(service, handler);

        extractor.fetchPage();
        InfoItemsPage<InfoItem> page = extractor.getInitialPage();
        List<InfoItem> items = page.getItems();

        List<ChannelInfoItem> channels = items.stream()
                .filter(item -> item instanceof ChannelInfoItem)
                .map(item -> (ChannelInfoItem) item)
                .filter(c -> isLikelyArtist(c.getName()))
                .limit(limit)
                .toList();

        if (channels.isEmpty()) {
            JsonObject result = new JsonObject();
            result.addProperty("artist", query);
            result.addProperty("artist_id", "");
            result.addProperty("thumbnail", "");
            result.add("tracks", new JsonArray());
            System.out.println(new Gson().toJson(result));
            return;
        }

        ChannelInfoItem artist = channels.get(0);
        String channelId = extractChannelId(artist.getUrl());

        JsonObject result = new JsonObject();
        result.addProperty("artist", artist.getName());
        result.addProperty("artist_id", channelId);
        if (!artist.getThumbnails().isEmpty()) {
            result.addProperty("thumbnail", artist.getThumbnails().get(0).getUrl());
        }

        JsonArray tracks = new JsonArray();
        for (InfoItem item : items) {
            if (item instanceof StreamInfoItem) {
                StreamInfoItem stream = (StreamInfoItem) item;
                JsonObject t = new JsonObject();
                t.addProperty("title", stream.getName());
                t.addProperty("url", stream.getUrl());
                t.addProperty("duration", stream.getDuration());
                tracks.add(t);
            }
        }
        result.add("tracks", tracks);

        System.out.println(new Gson().toJson(result));
    }

    // Popular search terms whose top artist results are aggregated into a top-100 list
    private static final String[] TOP100_QUERIES = {
            "pop music", "hip hop", "r&b", "rock music", "country music",
            "edm", "kpop", "latin music", "alternative", "indie",
            "reggaeton", "afrobeats", "jazz", "classical music", "metal",
            "punk", "funk", "soul", "blues", "folk music",
            "dance pop", "trap music", "house music", "techno", "drum and bass",
            "top hits 2025", "billboard hot 100", "new music", "viral music", "trending"
    };

    static void getTop100Artists(YoutubeService service, int limit) throws Exception {
        Map<String, JsonObject> seen = new java.util.LinkedHashMap<>();

        // Search in parallel batches of 5
        List<String[]> batches = new java.util.ArrayList<>();
        for (int i = 0; i < TOP100_QUERIES.length; i += 5) {
            batches.add(java.util.Arrays.copyOfRange(TOP100_QUERIES, i, Math.min(i + 5, TOP100_QUERIES.length)));
        }

        for (String[] batch : batches) {
            List<CompletableFuture<Void>> futures = new java.util.ArrayList<>();
            for (String q : batch) {
                final String query = q;
                futures.add(CompletableFuture.runAsync(() -> {
                    try {
                        SearchQueryHandler handler = new SearchQueryHandler(
                                "https://music.youtube.com/search?q=" + query.replace(" ", "+"),
                                "https://music.youtube.com/search?q=" + query.replace(" ", "+"),
                                query,
                                Collections.singletonList("music_artists"),
                                null);
                        YoutubeMusicSearchExtractor extractor = new YoutubeMusicSearchExtractor(service, handler);
                        extractor.fetchPage();
                        List<InfoItem> items = extractor.getInitialPage().getItems();
                        for (InfoItem item : items) {
                            if (!(item instanceof ChannelInfoItem)) continue;
                            ChannelInfoItem channel = (ChannelInfoItem) item;
                            if (!isLikelyArtist(channel.getName())) continue;
                            String key = channel.getName().toLowerCase();
                            if (seen.containsKey(key)) continue;
                            JsonObject artist = new JsonObject();
                            artist.addProperty("name", channel.getName());
                            artist.addProperty("channel_id", extractChannelId(channel.getUrl()));
                            if (!channel.getThumbnails().isEmpty()) {
                                artist.addProperty("thumbnail", channel.getThumbnails().get(0).getUrl());
                            }
                            seen.put(key, artist);
                        }
                    } catch (Exception ignored) {}
                }));
            }
            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
            if (seen.size() >= limit) break;
        }

        JsonArray artists = new JsonArray();
        for (JsonObject a : seen.values()) {
            artists.add(a);
            if (artists.size() >= limit) break;
        }

        JsonObject result = new JsonObject();
        result.add("artists", artists);
        System.out.println(new Gson().toJson(result));
    }

    static String extractChannelId(String url) {
        if (url == null) return "";
        int idx = url.indexOf("channel/");
        if (idx >= 0) {
            int end = url.indexOf('/', idx + 8);
            return end > 0 ? url.substring(idx + 8, end) : url.substring(idx + 8);
        }
        return "";
    }
}
