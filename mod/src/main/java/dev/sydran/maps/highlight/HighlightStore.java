package dev.sydran.maps.highlight;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;

public class HighlightStore {
    private static final List<HighlightEntry> entries = new ArrayList<>();
    private static final ConcurrentLinkedQueue<String> pendingHighlights = new ConcurrentLinkedQueue<>();

    public interface Restorer { void restore(); }

    public static class HighlightEntry {
        public final String orderCode;
        public final String location;
        public final Restorer restorer;
        public HighlightEntry(String orderCode, String location, Restorer restorer) {
            this.orderCode = orderCode; this.location = location; this.restorer = restorer;
        }
    }

    public static void requestHighlight(String orderCode) { pendingHighlights.add(orderCode); }
    public static String pollPendingHighlight() { return pendingHighlights.poll(); }

    public static void add(String orderCode, String location, Restorer restorer) {
        synchronized (entries) { entries.add(new HighlightEntry(orderCode, location, restorer)); }
    }

    public static void clearForOrder(String orderCode) {
        synchronized (entries) {
            entries.removeIf(entry -> {
                if (entry.orderCode.equalsIgnoreCase(orderCode)) {
                    try { entry.restorer.restore(); } catch (Exception e) {
                        dev.sydran.maps.SydranMapsMod.LOGGER.warn("[Sydran Maps] Failed to restore: {}", entry.location);
                    }
                    return true;
                }
                return false;
            });
        }
    }

    public static void clearAll() {
        synchronized (entries) {
            for (HighlightEntry entry : new ArrayList<>(entries)) {
                try { entry.restorer.restore(); } catch (Exception e) {
                    dev.sydran.maps.SydranMapsMod.LOGGER.warn("[Sydran Maps] Failed to restore: {}", entry.location);
                }
            }
            entries.clear();
        }
    }

    public static int countForOrder(String orderCode) {
        synchronized (entries) {
            int count = 0;
            for (HighlightEntry entry : entries) if (entry.orderCode.equalsIgnoreCase(orderCode)) count++;
            return count;
        }
    }

    public static boolean hasAny() { synchronized (entries) { return !entries.isEmpty(); } }
}
