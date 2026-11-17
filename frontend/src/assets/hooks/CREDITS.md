# Celebration hook animations — credits

These Lottie animations are self-hosted so the Memory Vault never calls a
third-party player or CDN at runtime. All were downloaded from LottieFiles as
`.lottie` packages on **17 November 2026**, then the animation JSON was
extracted and committed here.

License for every file: **Lottie Simple License**
(<https://lottiefiles.com/page/license>). It allows commercial use,
modification, and redistribution as part of a product, provided the files are
not sold on their own and the license notice is preserved. Attribution is
encouraged and is listed below.

| File | LottieFiles page | Animation | Creator |
| --- | --- | --- | --- |
| `cake.json` | <https://lottiefiles.com/free-animation/birthday-cake-kIgrdBHr1f> | Birthday cake | Isaree Sook |
| `rose.json` | <https://lottiefiles.com/free-animation/rose-26ndeDopRN> | Rose | Manoj Kumar |
| `graduation.json` | <https://lottiefiles.com/free-animation/graduation-hat-qI7xIRLRX5> | Graduation hat | Animo Arts |
| `gift-box.json` | <https://lottiefiles.com/free-animation/happy-gift-ecZGzJVxll> | Happy gift | Jacques Mauriac |
| `bouquet.json` | <https://lottiefiles.com/free-animation/flowers-bouquet-animation-bniOKamcLr> | Flowers bouquet | Konkapp Design |
| `envelope.json` | <https://lottiefiles.com/free-animation/love-letter-JlZMgF8c9a> | Love letter | hamna |
| `celebration.json` | <https://lottiefiles.com/free-animation/celebration-oESlIcSSbO> | Celebration | Sinem Kocabaş |
| `confetti.json` | <https://lottiefiles.com/free-animation/confetti-3ofTs67sBx> | Confetti | Shubh Dubey |

The original `.lottie` packages were not committed; only the extracted
animation JSON is used. No external images, fonts, or expressions requiring
network access are needed at runtime.

## Modifications

`rose.json`, `envelope.json`, and `confetti.json` shipped with Adobe After
Effects expressions. The site enforces a Content Security Policy without
`unsafe-eval`, so every `"x"` expression string was removed from those files on
17 November 2026. The animations keep their keyframed motion; only the
expression-driven secondary sway/loop/spin is omitted. No other animation
content was changed.
