# The voice-over

How to make the voice for the CarBoard ad in ElevenLabs. The finished recording goes to
`public/voice/full.mp3`, then `npm run voice -- --split` cuts it into the six scenes.

## 1. The voice

Either pick a voice from **Voices → Voice Library**, filtered to **Language: Hebrew** (a native Israeli
speaker sounds far better than an English voice reading Hebrew), or create one in **Voice Design** with
this description:

> A warm, confident Israeli voice in their thirties, native Hebrew with a neutral Tel Aviv accent. Friendly
> and relaxed, like a good TV commercial: clear, smiling, never shouting. Studio quality, close microphone,
> no background noise.

## 2. Settings

- Model: **Eleven v3**
- Stability: **Natural** (more expressive than Robust, steadier than Creative)
- Speed: a little slower than normal, about **0.95**
- Generate 3 or 4 takes and keep the best one.

## 3. The script

Paste it as it is, with the empty lines: they make the pauses the ad is cut at. The words in square
brackets are delivery cues for v3; it acts them, it does not read them.

```
[thoughtful] מתי הטסט? מתי הביטוח? [slight pause] ומתי, בעצם, עשינו טיפול?

[warmly] תכירו: קאר בורד.

[confident] הכל על הרכב, במקום אחד. [softly] ואנחנו נזכיר לכם, לפני שמשהו מגיע.

[curious] כמה עולה לכם הדלק? [smiling] עכשיו, אתם יודעים.

[relaxed] רישיון, ביטוח, וקבלות. הכל בכיס, תמיד.

[warmly] קאר בורד. כל הרכב, במקום אחד.
```

If a take sounds acted or the cues throw the intonation off, use the same script without the brackets
(it is in `src/lines.json`).

## 4. What to listen for

- The questions at the start sound like someone thinking out loud, not a quiz.
- "קאר בורד" is said the same way both times, stress on "בורד".
- Each line ends low and settled, on its last word: מגיע, יודעים, תמיד, אחד.
- About a second of silence between the lines. If the voice runs two lines together, add "..." at the end
  of the first one.
