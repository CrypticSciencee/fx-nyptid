# FX receipts scraper

Public oEmbed puller for x.com status URLs. No login. No cookies. No auto-like bot.

```bash
pip install -r scraper/requirements.txt
python scraper/fx_receipts.py --file scraper/urls.txt --out scraper/out/receipts.json
```

Drop more post URLs in `urls.txt`. The live wall on the site is the form at `/#proof` — this scraper is for bulk receipts you already have links to.
