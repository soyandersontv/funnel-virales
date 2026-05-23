# Instrucciones para Claude Code — Prueba Trafficker Senior 30X
## Stack: Next.js + Supabase (ya conectados) + Vercel

---

## PASO 1 — Crear la tabla en Supabase

Ve al SQL Editor de tu proyecto en Supabase y ejecuta esto:

```sql
CREATE TABLE prueba_trafficker (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Candidato
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,

  -- Tiempo
  tiempo_segundos INTEGER,
  tiempo_formato TEXT,
  timeout BOOLEAN DEFAULT FALSE,

  -- Scores
  mcq_correctas INTEGER,
  mcq_total INTEGER,
  mcq_porcentaje NUMERIC(5,2),
  abiertas_completas INTEGER,
  abiertas_total INTEGER,
  score_ponderado INTEGER,

  -- Flags
  flag_ia BOOLEAN DEFAULT FALSE,
  veredicto TEXT, -- 'PASA' | 'REVISAR' | 'NO_APLICA'

  -- Respuestas completas
  respuestas JSONB
);

-- RLS: cualquiera puede insertar (la prueba es pública), nadie puede leer desde el cliente
ALTER TABLE prueba_trafficker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert_public" ON prueba_trafficker
  FOR INSERT WITH CHECK (true);
```

---

## PASO 2 — Estructura de archivos a crear

```
app/
├── prueba/
│   └── page.tsx           ← UI completa de la prueba
├── api/
│   └── submit-prueba/
│       └── route.ts       ← Guarda en Supabase (server-side con service role)
lib/
└── questions.ts           ← Las 30 preguntas
```

---

## PASO 3 — API Route (`app/api/submit-prueba/route.ts`)

Usar el **service role key** para bypass de RLS en el insert:

```typescript
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const { data, error } = await supabase
      .from('prueba_trafficker')
      .insert([{
        nombre: body.nombre,
        email: body.email,
        tiempo_segundos: body.tiempoSegundos,
        tiempo_formato: body.tiempoFormato,
        timeout: body.timeout,
        mcq_correctas: body.mcqCorrectas,
        mcq_total: body.mcqTotal,
        mcq_porcentaje: body.mcqPorcentaje,
        abiertas_completas: body.abiertasCompletas,
        abiertas_total: body.abiertasTotal,
        score_ponderado: body.scorePonderado,
        flag_ia: body.flagIA,
        veredicto: body.veredicto,
        respuestas: body.respuestas,
      }])
      .select('id')
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data.id })

  } catch (err) {
    console.error('Server error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
```

---

## PASO 4 — Variables de entorno necesarias

En `.env.local` y en Vercel → Settings → Environment Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

El `SUPABASE_SERVICE_ROLE_KEY` solo va server-side (sin el prefijo `NEXT_PUBLIC_`).

---

## PASO 5 — Página de la prueba (`app/prueba/page.tsx`)

### Pantalla 0 — Identificación del candidato
Mostrar ANTES de empezar el cronómetro:
```
Nombre completo: [input requerido]
Email:           [input requerido]
[Comenzar prueba →]
```

### Pantalla 1 — La prueba
- 30 preguntas · 60 minutos · cronómetro sin pausa
- Barra de progreso visible
- Header fondo `#0D0D0D`, acento `#E9FF7B`
- Tipos de pregunta: `mcq`, `calc`, `open`, `error`
- En preguntas tipo `open` y `error`: textarea con contador de caracteres y mínimo requerido
- Detector de lenguaje formulaico de IA en cada textarea (ver lista abajo)
- Tablas de datos en preguntas tipo `error`
- Contexto destacado en recuadro con borde izquierdo amarillo

**Frases formulaicas de IA a detectar (marcar si hay 2+ en una respuesta):**
```
['en conclusión','en primer lugar','en segundo lugar','en resumen',
 'cabe destacar','es importante mencionar','sin duda','es fundamental',
 'asimismo','por otro lado','a continuación','en este sentido',
 'cabe mencionar','cabe señalar','vale la pena mencionar']
```

### Pantalla 2 — Enviando
```
Guardando resultados...
[spinner]
```
Llama a POST /api/submit-prueba con el objeto completo.

### Pantalla 3 — Confirmación (lo que ve el candidato)
```
✓ Prueba completada

Tu resultado ha sido registrado.
El equipo de 30X revisará tu prueba y se pondrá en contacto contigo.

[NO mostrar respuestas correctas ni score detallado al candidato]
[Solo mostrar: "Gracias, {nombre}. Revisaremos tu prueba pronto."]
```

---

## PASO 6 — Objeto que se envía al API (construir en el frontend)

```typescript
const payload = {
  // Candidato
  nombre: string,
  email: string,

  // Tiempo
  tiempoSegundos: number,      // segundos usados
  tiempoFormato: string,       // "42m 18s"
  timeout: boolean,

  // Scores calculados en frontend
  mcqCorrectas: number,
  mcqTotal: number,            // 20
  mcqPorcentaje: number,       // mcqCorrectas/20 * 100
  abiertasCompletas: number,   // respuestas abiertas con chars >= minChars
  abiertasTotal: number,       // 10
  scorePonderado: number,      // Math.round(mcqPct*0.6 + openPct*0.4) * 100
  flagIA: boolean,
  veredicto: string,           // 'PASA' | 'REVISAR' | 'NO_APLICA'

  // Todas las respuestas como JSON
  respuestas: {
    [questionId: number]: {
      tipo: string,            // 'mcq' | 'calc' | 'open' | 'error'
      pregunta: string,        // título de la pregunta
      respuesta: string | number, // texto o índice de opción seleccionada
      opcionTexto?: string,    // para mcq: el texto de la opción elegida
      esCorrecta?: boolean,    // para mcq/calc
      seccion: string,
    }
  }
}
```

**Lógica del veredicto:**
```typescript
const mcqPct = mcqCorrectas / 20
const pass = !timeout && mcqPct >= 0.7 && abiertasCompletas >= 4
const review = !timeout && !pass && (mcqPct >= 0.5 || abiertasCompletas >= 3)
const veredicto = timeout ? 'NO_APLICA' : pass ? 'PASA' : review ? 'REVISAR' : 'NO_APLICA'
```

---

## PASO 7 — Las 30 preguntas (`lib/questions.ts`)

```typescript
export type Question = {
  id: number
  section: string
  type: 'mcq' | 'calc' | 'open' | 'error'
  title: string
  context?: string
  prompt?: string
  options?: string[]
  correct?: number
  tableData?: string[][]
  minChars?: number
}

export const QUESTIONS: Question[] = [
  // SECCIÓN 1: META ADS ESTRUCTURA
  {
    id: 1, section: "Meta Ads — Estructura", type: "mcq",
    title: "¿Qué optimiza Meta Ads cuando eliges el objetivo 'Ventas' en una campaña de conversiones?",
    options: [
      "Clicks al sitio web de forma masiva",
      "Mostrar el anuncio a personas con mayor probabilidad de completar la conversión definida",
      "Maximizar el alcance único por menor costo",
      "Aumentar el CTR del anuncio"
    ],
    correct: 1
  },
  {
    id: 2, section: "Meta Ads — Estructura", type: "mcq",
    title: "¿Cuál es la diferencia funcional entre CBO y ABO en Meta Ads?",
    options: [
      "CBO permite crear más ad sets, ABO no",
      "CBO distribuye el presupuesto automáticamente entre ad sets; ABO fija el presupuesto por ad set",
      "CBO solo funciona para campañas de tráfico, ABO para conversiones",
      "No hay diferencia práctica, es solo nomenclatura"
    ],
    correct: 1
  },
  {
    id: 3, section: "Meta Ads — Datos", type: "calc",
    context: "Fórmula: CPC = CPM / (CTR% × 10)",
    title: "Tienes un ad set con CTR del 0.4% y CPM de $12. ¿Cuál es tu CPC aproximado?",
    options: ["$0.05", "$3.00", "$4.80", "$12.00"],
    correct: 1
  },
  {
    id: 4, section: "Meta Ads — Audiences", type: "mcq",
    title: "Estás en fase de testing creativo (TOF). ¿Qué tipo de audiencia usarías primero para validar hooks?",
    options: [
      "Lookalike 1% de compradores pasados",
      "Retargeting de visitantes web últimos 30 días",
      "Broad (sin intereses) o intereses amplios — dejar que el algoritmo optimice",
      "Custom audience de lista de clientes"
    ],
    correct: 2
  },
  {
    id: 5, section: "Meta Ads — Pixel", type: "mcq",
    title: "¿Qué evento del pixel debes tener bien configurado para optimizar campañas de conversión hacia ventas reales?",
    options: ["PageView", "ViewContent", "Purchase (con value y currency)", "AddToCart"],
    correct: 2
  },
  {
    id: 6, section: "Meta Ads — Escalado", type: "mcq",
    title: "Un ad set tiene ROAS 8x con $500 de spend. Quieres escalar. ¿Cuál es el enfoque correcto?",
    options: [
      "Duplicar el ad set y triplicar el presupuesto de inmediato",
      "Aumentar presupuesto entre 20–30% cada 48–72 horas monitoreando CPM y frecuencia",
      "Pausar y crear una campaña nueva con el mismo creativo",
      "Mover el creativo a una campaña de tráfico para ampliar alcance primero"
    ],
    correct: 1
  },

  // SECCIÓN 2: COPY Y CREATIVOS
  {
    id: 7, section: "Copy de performance", type: "mcq",
    title: "¿Cuál de estos hooks tiene más probabilidad de parar el scroll para un programa de $2.000 dirigido a founders?",
    options: [
      "'Aprende a escalar tu negocio con las mejores estrategias'",
      "'Llevamos 3 años enseñando growth a emprendedores LATAM'",
      "'Sigues siendo el cuello de botella de tu empresa — y lo sabes'",
      "'Programa premium para líderes empresariales comprometidos con el crecimiento'"
    ],
    correct: 2
  },
  {
    id: 8, section: "Copy de performance", type: "open",
    context: "30X · programa negociación · 4 semanas · online · ICP: gerentes comerciales B2B Colombia con equipos 3–10 personas · Pain: pierden deals por dar descuentos sin estructura · Copy en español, tono directo",
    title: "Escribe 2 hooks + 1 ángulo para un programa de negociación de $1.500, dirigido a gerentes comerciales B2B en Colombia.",
    prompt: "Copy en español LATAM. Debe sonar a criterio real, no a IA.",
    minChars: 220
  },
  {
    id: 9, section: "Copy de performance", type: "mcq",
    title: "¿Cuál es la principal diferencia entre un ángulo y un hook en un video ad?",
    options: [
      "Son lo mismo, solo se usan en distintas plataformas",
      "El hook es el elemento visual; el ángulo es el texto",
      "El hook son los primeros 3 segundos que detienen el scroll; el ángulo es el encuadre del problema/solución que sostiene todo el mensaje",
      "El ángulo es el CTA; el hook es el cuerpo del copy"
    ],
    correct: 2
  },

  // SECCIÓN 3: FUNNELS Y CRO
  {
    id: 10, section: "Funnels y CRO", type: "mcq",
    title: "El formulario de aplicación tiene 60% de abandono en la pregunta 4 de 6. ¿Cuál es tu primera hipótesis y acción?",
    options: [
      "Cambiar el color del botón de 'Enviar'",
      "La pregunta 4 genera fricción o tiene formato incómodo — testear eliminándola o reordenando",
      "Reducir el presupuesto hasta optimizar el formulario",
      "Cambiar el objetivo de la campaña a tráfico"
    ],
    correct: 1
  },
  {
    id: 11, section: "Funnels y CRO", type: "open",
    context: "IA para Abogados · $497 · Virtual · 32h · 6 semanas · Compra directa en web · ICP: abogados litigantes y firmas privadas Colombia · Sin llamada de ventas · Spokesperson: Andrés Bilbao",
    title: "Diseña el funnel completo para IA para Abogados de 30X (compra directa, $497, sin llamada de ventas).",
    prompt: "Describe cada etapa: canal, creativos, landing, acción esperada y cómo mides conversión en cada etapa. No uses estructura genérica.",
    minChars: 250
  },
  {
    id: 12, section: "Funnels y CRO", type: "mcq",
    title: "¿Cuál métrica del funnel indica que el problema está en la calidad del lead y no en el closer?",
    options: [
      "CPL alto",
      "Show-up rate bajo en llamadas",
      "Tasa de cierre baja en llamadas con leads que sí se presentan",
      "CPM en aumento en los últimos 7 días"
    ],
    correct: 1
  },

  // SECCIÓN 4: TRACKING Y ATRIBUCIÓN
  {
    id: 13, section: "Tracking y atribución", type: "mcq",
    title: "Un lead llega por Meta Ads pero en HubSpot aparece como fuente 'Direct'. ¿Cuál es la causa más probable?",
    options: [
      "HubSpot tiene un bug con Meta Ads",
      "La landing page no está pasando los parámetros UTM al formulario o al cookie de sesión",
      "El pixel de Meta no está instalado correctamente",
      "El lead usó modo incógnito"
    ],
    correct: 1
  },
  {
    id: 14, section: "Tracking y atribución", type: "open",
    title: "Explica cómo calcularías el ROAS general de un programa conectando Meta Ads + Typeform + HubSpot + cierre por teléfono.",
    prompt: "Sé específico: qué campo en HubSpot, qué lógica de matching, cómo atribuyes una venta al ad cuando hay 3–7 días entre el click y el cierre. Menciona los límites del modelo.",
    minChars: 200
  },
  {
    id: 15, section: "Tracking y atribución", type: "calc",
    context: "ROAS general = (12×$3.000)/$6.000 = 6x | Meta: (0.7×12×$3.000)/$4.800 = 6.3x | LinkedIn: (0.3×12×$3.000)/$1.200 = 9x",
    title: "Un programa cerró 12 ventas a $3.000 c/u. Gasto Meta: $4.800. Gasto LinkedIn: $1.200. 70% atribuye a Meta, 30% a LinkedIn. ¿ROAS general y por canal?",
    options: [
      "ROAS general 7.5x · Meta 5.25x · LinkedIn 9x",
      "ROAS general 6x · Meta 5.25x · LinkedIn 9x",
      "ROAS general 6x · Meta 6.3x · LinkedIn 9x",
      "ROAS general 7.5x · Meta 6.3x · LinkedIn 7.5x"
    ],
    correct: 2
  },

  // SECCIÓN 5: DETECCIÓN DE ERRORES
  {
    id: 16, section: "Detección de errores", type: "error",
    title: "Esta tabla tiene UN dato incorrecto. Identifícalo y explica por qué con el cálculo.",
    tableData: [
      ["Campaña","Spend","Leads","CPL","Calls","Show-up","Ventas","CPA"],
      ["TOF Video","$2.000","520","$3.84","—","—","—","—"],
      ["MOF Retargeting","$1.200","95","$12.6","71","75%","9","$133"],
      ["BOF Direct","$800","28","$28.5","25","88%","7","$114"],
      ["TOTAL","$4.000","643","$6.2","96","80%","16","$250"]
    ],
    prompt: "¿Cuál es el dato incorrecto? Muestra el cálculo que lo demuestra.",
    minChars: 80
  },
  {
    id: 17, section: "Detección de errores", type: "error",
    context: "Programa: $2.500 ticket · 20 ventas · Spend total $5.000 · El trafficker reporta ROAS 10x.",
    title: "Revisa este reporte de ROAS y encuentra el error o lo que falta.",
    tableData: [
      ["Métrica","Valor reportado"],
      ["Ingresos totales","$50.000"],
      ["Spend","$5.000"],
      ["ROAS","10x"],
      ["CPA","$250"],
      ["CVR leads→venta","8% sobre 250 leads"]
    ],
    prompt: "¿Hay error? ¿Qué falta para que sea ROAS general real y no solo ROAS de plataforma?",
    minChars: 80
  },
  {
    id: 18, section: "Detección de errores", type: "error",
    context: "Campaña CBO — Objetivo: Tráfico | Ad Set 1: Interés 'Emprendimiento' $500/día | Ad Set 2: Retargeting visitantes 30d $500/día | Ad Set 3: Lookalike 1% compradores $500/día. El trafficker reporta: leads baratos pero no convierten.",
    title: "Analiza esta estructura de campaña y di qué está mal desde una perspectiva de performance.",
    prompt: "Identifica mínimo 2 errores estructurales o de lógica. Explica qué cambiarías y por qué.",
    minChars: 120
  },

  // SECCIÓN 6: LEAD SCORING
  {
    id: 19, section: "Lead scoring", type: "mcq",
    title: "Un lead agenda llamada, es CEO de empresa $1M+ ARR y quiere resultados en 90 días. ¿Cuál es el SLA de contacto ideal?",
    options: [
      "24–48 horas después de agendar",
      "Menos de 2 horas desde que agenda",
      "Solo el día de la llamada confirmada",
      "Cuando el closer tenga disponibilidad en la semana"
    ],
    correct: 1
  },
  {
    id: 20, section: "Lead scoring", type: "open",
    title: "Diseña un sistema de lead scoring para Inmersivo 30X ($6.000). Define variables, pesos y routing entre 2 closers.",
    prompt: "ICP: founder/CEO LATAM, empresa $300K+ ingresos. 2 closers: uno B2B ticket alto, uno founders early-stage. Define 5+ variables de scoring, cómo las captura Typeform, cómo llegan a HubSpot y cuándo se dispara el routing.",
    minChars: 230
  },

  // SECCIÓN 7: ESTRATEGIA Y PRIORIZACIÓN
  {
    id: 21, section: "Estrategia y priorización", type: "open",
    title: "Lunes 8am, 5 programas activos, $18k gasto mensual total. ¿Cómo estructuras tu semana?",
    prompt: "Describe tu cadencia diaria/semanal: qué revisas y cuándo, cómo priorizas si dos programas tienen problemas simultáneos, qué métricas son tus alarmas de pausa inmediata. Menciona herramientas y métricas concretas.",
    minChars: 220
  },
  {
    id: 22, section: "Estrategia y priorización", type: "mcq",
    title: "Tienes presupuesto limitado y 3 programas activos. ¿Cómo decides cuánto asignar a cada uno?",
    options: [
      "Igual a todos para no crear sesgos",
      "Basado en ROAS histórico, tamaño del ticket y urgencia del lanzamiento/cierre",
      "Primero al programa con más leads del mes anterior",
      "Basado en las preferencias del Head de Programas"
    ],
    correct: 1
  },
  {
    id: 23, section: "Estrategia y priorización", type: "mcq",
    title: "¿Cuándo pausarías una campaña sin esperar aprobación?",
    options: [
      "Cuando el CPL suba un 10% vs el promedio",
      "Cuando el ROAS general caiga por debajo del break-even o haya un error técnico crítico (pixel caído, URL rota, formulario roto)",
      "Cuando el CTR baje un 5%",
      "Solo con autorización, nunca de forma unilateral"
    ],
    correct: 1
  },

  // SECCIÓN 8: CÁLCULOS
  {
    id: 24, section: "Cálculos", type: "calc",
    context: "CPA máximo = Ticket / ROAS objetivo = $4.000 / 8 = $500",
    title: "Ticket $4.000 · margen neto 35% · ROAS general mínimo 8x. ¿Cuál es el CPA máximo por venta?",
    options: ["$500", "$350", "$400", "$450"],
    correct: 0
  },
  {
    id: 25, section: "Cálculos", type: "calc",
    context: "Calls: 1200×0.22=264 | Calls reales: 264×0.68=179 | Ventas: 179×0.18≈32 | CVR e2e: 32/1200=2.7%",
    title: "1.200 leads · CVR lead→llamada 22% · Show-up 68% · CVR llamada→venta 18%. ¿Ventas esperadas y CVR end-to-end?",
    options: [
      "Ventas: 32 · CVR e2e: 2.7%",
      "Ventas: 29 · CVR e2e: 2.4%",
      "Ventas: 41 · CVR e2e: 3.4%",
      "Ventas: 38 · CVR e2e: 3.2%"
    ],
    correct: 0
  },
  {
    id: 26, section: "Cálculos", type: "calc",
    context: "Ingresos meta: 15×$3.500=$52.500 | Presupuesto max: $52.500/10=$5.250 | CPA max: $5.250/15=$350",
    title: "Meta: 15 ventas · ticket $3.500 · ROAS mínimo 10x. ¿Presupuesto máximo en ads y CPA máximo?",
    options: [
      "Presupuesto $5.250 · CPA $350",
      "Presupuesto $5.000 · CPA $333",
      "Presupuesto $4.500 · CPA $300",
      "Presupuesto $6.000 · CPA $400"
    ],
    correct: 0
  },

  // SECCIÓN 9: HUBSPOT Y CRM
  {
    id: 27, section: "HubSpot y CRM", type: "mcq",
    title: "¿Qué propiedad de HubSpot revisas para saber si un contacto entró por un ad de Meta Ads específico?",
    options: [
      "'Source' (fuente original)",
      "'UTM Campaign' capturado en el formulario o por cookie de sesión + propiedad personalizada",
      "'Email marketing'",
      "'First conversion' del contact record"
    ],
    correct: 1
  },
  {
    id: 28, section: "HubSpot y CRM", type: "mcq",
    title: "¿Cómo verificas que el loop Ads → CRM funciona correctamente antes de lanzar?",
    options: [
      "Esperas a tener 50 leads y revisas manualmente",
      "Haces un lead de prueba end-to-end: click en ad → formulario → verificas en HubSpot con UTM correcto, fuente correcta y stage correcto",
      "Confías en el pixel de Meta para validar",
      "Revisas el dashboard de Meta Ads al día siguiente"
    ],
    correct: 1
  },

  // SECCIÓN 10: IA Y CASO FINAL
  {
    id: 29, section: "IA y automatización", type: "open",
    title: "¿Cómo usas IA en tu flujo de trabajo como trafficker? Da 3 ejemplos concretos, no genéricos.",
    prompt: "No sirve 'uso ChatGPT para copy'. Describe exactamente qué prompt usas, qué output obtienes, cómo lo iteras y cómo te ahorra tiempo o mejora decisiones. Incluye al menos un ejemplo de análisis de datos con IA.",
    minChars: 200
  },
  {
    id: 30, section: "Caso final", type: "open",
    context: "Inmersivo 30X · $6.000 USD · Presencial · 50 personas · LATAM · Andrés Bilbao como figura central · HubSpot + closers para cierre · Meta Ads principal canal",
    title: "Caso final: Inmersivo 30X — $6.000 ticket, 50 cupos, lanzar en 45 días. Diseña la estrategia de paid media completa.",
    prompt: "Define: presupuesto sugerido, canales, estructura de campañas por etapa (awareness → retargeting → cierre), KPIs por semana, y qué harías en la semana 3 si el ROAS está en 3x. Sin estructura genérica.",
    minChars: 300
  }
]
```

---

## PASO 8 — Cómo ver los resultados en Supabase

Una vez que los candidatos hagan la prueba, Anderson puede ver todo desde:

**Supabase Dashboard → Table Editor → prueba_trafficker**

Las columnas más útiles de un vistazo:
- `nombre`, `email` — quién hizo la prueba
- `created_at` — cuándo (hora Colombia automática)
- `veredicto` — PASA / REVISAR / NO_APLICA
- `score_ponderado` — número del 0 al 100
- `mcq_porcentaje` — qué tan sólidos son los conceptos
- `abiertas_completas` — cuántas preguntas abiertas respondió bien
- `flag_ia` — si el sistema detectó lenguaje de IA
- `timeout` — si se quedó sin tiempo
- `respuestas` — JSON con todas las respuestas textuales para leer

**Query útil para ordenar candidatos:**
```sql
SELECT
  nombre,
  email,
  created_at AT TIME ZONE 'America/Bogota' as fecha_bogota,
  veredicto,
  score_ponderado,
  mcq_porcentaje,
  abiertas_completas,
  flag_ia,
  timeout,
  tiempo_formato
FROM prueba_trafficker
ORDER BY score_ponderado DESC, created_at DESC;
```

---

## Flujo completo

```
Candidato abre /prueba
    ↓
Ingresa nombre + email → [Comenzar]
    ↓
30 preguntas · 60 minutos · cronómetro sin pausa
    ↓
Finaliza o se agota el tiempo
    ↓
Frontend calcula scores y construye payload JSON
    ↓
POST /api/submit-prueba (server-side con service role)
    ↓
INSERT en Supabase → tabla prueba_trafficker
    ↓
Pantalla de confirmación al candidato
(Sin mostrar respuestas correctas ni score detallado)
    ↓
Anderson ve todos los resultados en Supabase Table Editor
ordenados por score_ponderado DESC
```
