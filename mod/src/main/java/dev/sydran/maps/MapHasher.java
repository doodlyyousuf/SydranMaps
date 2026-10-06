package dev.sydran.maps;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

public final class MapHasher {
    private MapHasher() {}

    public static String sha256Hex(byte[] data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(data);
            return bytesToHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    public static String tileHash(byte[] colors, int posX, int posY, String productName) {
        StringBuilder sb = new StringBuilder();
        sb.append(productName).append(':').append(posX).append(',').append(posY).append(':');
        for (byte b : colors) sb.append(b & 0xFF).append(',');
        return sha256Hex(sb.toString().getBytes(StandardCharsets.UTF_8));
    }

    public static String productHash(String[] tileHashes) {
        StringBuilder combined = new StringBuilder();
        for (String h : tileHashes) combined.append(h);
        return sha256Hex(combined.toString().getBytes(StandardCharsets.UTF_8));
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
