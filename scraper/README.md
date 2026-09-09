# FX receipts scraper

Public oEmbed puller for x.com status URLs. No login. No cookies. No auto-like bot.

```bash
pip install -r scraper/requirements.txt
python scraper/fx_receipts.py --file scraper/urls.txt --out scraper/out/receipts.json --push https://fx.nyptid.com/api/feed
```

That writes JSON and dumps the posts into the Live feed tab. Drop more `x.com/handle/status/...` URLs in `urls.txt`.
