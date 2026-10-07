package dev.sydran.maps;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

public class SydranApiClient {
    private static final Gson GSON = new Gson();
    private final HttpClient client;
    private final SydranConfig config;

    public SydranApiClient(SydranConfig config) {
        this.config = config;
        this.client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    public JsonObject getStatus() throws Exception { return get("/api/mod/status"); }
    public JsonObject getClaimableOrders() throws Exception { return get("/api/orders/claimable"); }
    public JsonObject claimOrder(String orderCode, String claimedBy) throws Exception {
        return post("/api/orders/" + orderCode + "/claim", Map.of("claimedBy", claimedBy));
    }
    public JsonObject markDelivered(String orderCode, String deliveredBy) throws Exception {
        return post("/api/orders/" + orderCode + "/deliver", Map.of("deliveredBy", deliveredBy));
    }
    public JsonObject getRequiredMaps(String orderCode) throws Exception {
        return get("/api/orders/" + orderCode + "/required-maps");
    }
    public JsonObject updateConfig(Map<String, Object> patch) throws Exception { return put("/api/mod/config", patch); }
    public JsonObject duplicateCheck(String productName, String category, int width, int height) throws Exception {
        return post("/api/mod/duplicate-check", Map.of("productName", productName, "category", category, "width", width, "height", height));
    }
    public JsonObject addProduct(Map<String, Object> body) throws Exception { return post("/api/mod/add", body); }

    /** Public GET — used by ChatPaymentWatcher to fetch unverified users. */
    public JsonObject getRaw(String path) throws Exception { return get(path); }

    private JsonObject get(String path) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(config.getApiUrl() + path))
            .header("Authorization", authHeader())
            .timeout(Duration.ofSeconds(15)).GET().build();
        return send(req);
    }

    public JsonObject post(String path, Object body) throws Exception { return sendRequest(path, "POST", body); }
    private JsonObject put(String path, Object body) throws Exception { return sendRequest(path, "PUT", body); }

    private JsonObject sendRequest(String path, String method, Object body) throws Exception {
        String json = GSON.toJson(body);
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(config.getApiUrl() + path))
            .header("Authorization", authHeader())
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(30))
            .method(method, HttpRequest.BodyPublishers.ofString(json)).build();
        return send(req);
    }

    private JsonObject send(HttpRequest req) throws Exception {
        HttpResponse<String> res = client.send(req, HttpResponse.BodyHandlers.ofString());
        JsonObject json = JsonParser.parseString(res.body()).getAsJsonObject();
        if (res.statusCode() >= 400) {
            String error = json.has("error") ? json.get("error").getAsString() : "HTTP " + res.statusCode();
            throw new ApiException(res.statusCode(), error, json);
        }
        return json;
    }

    private String authHeader() { return "SydranPIN " + config.getAdminPin(); }

    public static class ApiException extends Exception {
        private final int statusCode;
        private final JsonObject body;
        public ApiException(int statusCode, String message, JsonObject body) {
            super(message); this.statusCode = statusCode; this.body = body;
        }
        public int getStatusCode() { return statusCode; }
        public JsonObject getBody() { return body; }
    }
}
