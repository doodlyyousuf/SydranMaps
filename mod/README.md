# Sydran Maps Fabric Mod

See the main project README for full documentation.

## Build

```bash
cd mod/
./gradlew build
# Output: build/libs/sydran-maps-1.0.0.jar
```

## Commands

| Command | Description |
|---|---|
| `/sydran status` | Show current config |
| `/sydran setprice <amount>` | Set upload price (150k, 1.5m, etc.) |
| `/sydran setcategory <name>` | Set category |
| `/sydran setsize <WxH>` | Set map dimensions (10x6, 2x2, 1x1) |
| `/sydran setduplicate <on\|off>` | Toggle duplicate detection |
| `/sydran add [name]` | Collect tiles + upload |
| `/sydran openorders` | List claimable orders with clickable buttons |
| `/sydran claim <code> <username>` | Claim order + highlight maps |
| `/sydran deliver <code> <username>` | Mark delivered + clear highlights |
| `/sydran rescan <code>` | Re-scan for required maps |
| `/sydran clearhighlights` | Clear all highlights |
| `/sydran config url <url>` | Set API URL |
| `/sydran config pin <pin>` | Set admin PIN |
