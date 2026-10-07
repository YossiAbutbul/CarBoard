// Reads the odometer number from a dashboard photo.
// The image is sent to Claude and is not stored. Needs the ANTHROPIC_API_KEY secret.
import Anthropic from 'npm:@anthropic-ai/sdk'

const client = new Anthropic() // reads ANTHROPIC_API_KEY

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const PROMPT = `This is a photo of a car dashboard. Read the odometer: the total distance the car has driven.
Ignore the trip meters (TRIP A, TRIP B), the clock, the outside temperature and the fuel range.
If the odometer is in miles, still return the number as shown and set unit to "mi".
If you cannot read the odometer with confidence, return km as null.`

const schema = {
  type: 'object',
  properties: {
    km: { type: ['integer', 'null'], description: 'The odometer value, digits only' },
    unit: { type: 'string', enum: ['km', 'mi'] },
  },
  required: ['km', 'unit'],
  additionalProperties: false,
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  let image: string, mediaType: string
  try {
    ;({ image, mediaType = 'image/jpeg' } = await req.json())
    if (typeof image !== 'string' || image.length < 100) throw new Error()
    if (image.length > 7_000_000) return json({ km: null, error: 'התמונה גדולה מדי' }, 413)
  } catch {
    return json({ km: null, error: 'bad request' }, 400)
  }

  try {
    const params = {
      model: 'claude-opus-5-5',
      max_tokens: 4096,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    }
    // deno-lint-ignore no-explicit-any
    const msg = await client.beta.messages.create(params as any)

    if (msg.stop_reason === 'refusal') return json({ km: null, error: 'לא ניתן לקרוא את התמונה' })
    const text = msg.content.find(b => b.type === 'text')
    if (!text || text.type !== 'text') return json({ km: null })

    const out = JSON.parse(text.text) as { km: number | null; unit: 'km' | 'mi' }
    if (out.km == null) return json({ km: null })
    const km = out.unit === 'mi' ? Math.round(out.km * 1.609344) : out.km
    return json({ km })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ km: null, error: 'עומס זמני. נסה שוב בעוד רגע' }, 429)
    if (e instanceof Anthropic.APIError) {
      console.error('anthropic', e.status, e.message)
      return json({ km: null, error: 'שגיאה בשירות הקריאה' }, 502)
    }
    console.error(e)
    return json({ km: null, error: 'שגיאה בשרת' }, 500)
  }
})
