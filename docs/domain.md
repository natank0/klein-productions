# כתובת אינטרנט קצרה עם "Klein Productions"

## האפשרויות (מהקצרה לארוכה)

| כתובת | אורך | עלות משוערת | הערות |
|---|---|---|---|
| **klein.productions** | 17 | ~₪120–160 לשנה | הכי קצרה, השם המדויק. סיומת חדשה: פחות מוכרת, וקשה יותר להכתיב בטלפון |
| **kleinproductions.com** | 20 | ~₪40–60 לשנה | בינלאומית ומוכרת |
| **kleinproductions.co.il** | 22 | ~₪60–100 לשנה | ישראלית, מעוררת אמון מקומי. **מומלצת כראשית** |
| kleinproductions.github.io | 26 | חינם | זמינה מיד, בלי לקנות דומיין |
| kleinproductions.pages.dev | 26 | חינם | דרך Cloudflare Pages |

> שימו לב: בישראל פועלת גם "סשה קליין הפקות". כדאי לוודא שהדומיין פנוי, ולשקול להירשם גם ל-.com כדי להגן על השם.

**ההמלצה:** לרכוש את `kleinproductions.co.il` כדומיין ראשי. אם רוצים כתובת קצרה במיוחד לפרסום, אפשר לרכוש גם את `klein.productions` ולהפנות אותה לראשי.

## איך לבדוק ולרכוש
1. `.co.il`: בודקים זמינות ב-https://www.isoc.org.il/domains (Whois), ורוכשים אצל רשם מורשה כמו LiveDNS, Domain The Net או Box.
2. `.com` / `.productions`: אפשר דרך Cloudflare Registrar (במחיר עלות), Namecheap או Porkbun.

## חיבור הדומיין לאתר (GitHub Pages)
1. ב-GitHub: **Settings ← Pages ← Custom domain**, מקלידים `kleinproductions.co.il` ושומרים. GitHub יוצר קובץ `CNAME` בריפו.
2. אצל רשם הדומיין מגדירים DNS:
   - 4 רשומות **A** לשורש (`@`): `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - רשומת **CNAME** ל-`www` שמצביעה על `natank0.github.io`
3. אחרי שה-DNS מתעדכן (בין דקות לכמה שעות) מסמנים **Enforce HTTPS**.

## בלי לקנות דומיין: kleinproductions.github.io (חינם)
1. ב-GitHub פותחים ארגון חינמי בשם `kleinproductions` (‏+ ← New organization ← Free).
2. מעבירים אליו את הריפו: Settings ← Transfer.
3. משנים את שם הריפו ל-`kleinproductions.github.io`.
4. מפעילים Pages מ-`main`. האתר יהיה זמין ב-`https://kleinproductions.github.io`.
