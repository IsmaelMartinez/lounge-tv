# Setting up Lounge TV on LG webOS

## Prerequisites

You need an LG Smart TV running webOS and a computer on the same network.

## Steps

1. Enable Developer Mode on your LG TV: install the "Developer Mode" app from the LG Content Store and sign in with an LG developer account (free at webostv.developer.lge.com).

2. Turn Developer Mode ON in the app and note the TV's IP address shown on screen.

3. Install the webOS CLI tools on your computer:

```
npm install -g @webos-tools/cli
```

4. Connect to your TV:

```
ares-setup-device --add myTV --info "{'host':'<TV_IP>','port':'9922','username':'prisoner'}"
ares-novacom --device myTV --getkey
```

Enter the passphrase shown on the TV.

5. Option A (hosted): Serve `index.html` from a local web server (e.g. a Raspberry Pi) and edit `webos/index.html` to point to its URL. Then package and install:

```
ares-package webos/
ares-install --device myTV com.ismaelmartinez.loungetv_1.0.0_all.ipk
```

6. Option B (standalone): Copy the main `index.html` into the `webos/` directory (replacing the redirect), then package and install as above.

## Notes

Developer Mode sessions expire after 50 hours. Re-enable periodically or look into rooting guides for persistent installation.

Some streams may be blocked by CORS when loaded directly on the TV. A local proxy server can solve this (planned for Phase 2).
