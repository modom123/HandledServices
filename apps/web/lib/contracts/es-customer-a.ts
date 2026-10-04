/*
 * FILE    : apps/web/lib/contracts/es-customer-a.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0048 UTC
 * UPDATED : 2026-10-04_2204 UTC — first looks (business account pros, customer favorites, crew member requests) and the open job board ("Jobs near you"); agreement v5 / Service Agreement v7.
 * PURPOSE : Spanish (neutral Latin-American, formal "usted") translations of the customer
 *           TERMS_OF_USE ("terms-of-use") and SERVICE_AGREEMENT ("service-agreement") in
 *           customer.ts. Same summary bullets and sections, same order and numbering; numbers
 *           come from @handled/core so they always match the English. The English controls.
 *           TEMPLATES — not legal advice.
 * UPDATED : 2026-10-03_0152 UTC — market pricing (precio sugerido, "proponga su precio", cargo de reserva,
 *           contraofertas de profesionales, aumentar la oferta): mirrors customer.ts section for section.
 */
import {
  AI_MAX_CUT,
  AI_MAX_RAISE,
  BOOKING_FEE,
  BRAND,
  DEPOSIT,
  HANDLED_PLUS,
  LATE_CANCEL_FEE,
  MARKET_BOUNDS,
  OFFER_BOUNDS,
  PRO_POLICY_DEFAULTS,
  RECURRING_DISCOUNT,
  RUSH_HOURS,
  RUSH_SURCHARGE,
  TIP_MAX,
  money,
} from "@handled/core";
import type { ContractSection, ContractTranslation } from "./types";

// ─── helpers (mirror customer.ts) ─────────────────────────────────────────────
const COUNSEL = " [Confirmar con un abogado.]";
const pct = (x: number) => `${Math.round(x * 100)}%`;
/** Paragraphs → one section body. */
const p = (...paras: string[]) => paras.join("\n\n");
/** Bullet list (one paragraph). */
const ul = (...items: string[]) => items.map((i) => `• ${i}`).join("\n");
/** Number the headings in order: "1. Título". */
const numbered = (items: [string, string][]): ContractSection[] => items.map(([h, body], i) => ({ h: `${i + 1}. ${h}`, p: body }));

const US = `${BRAND.legalName} ("${BRAND.name}", "nosotros")`;
const CONTACT = `escriba a ${BRAND.supportEmail} o llame al ${BRAND.supportPhone}`;
const MATERIALS_OK = money(PRO_POLICY_DEFAULTS.materials.autoApproveUpTo);
/** Cuánto puede mover el mercado local un precio sugerido, y el rango de "proponga su precio". */
const MARKET_DOWN = pct(1 - MARKET_BOUNDS.min);
const MARKET_UP = pct(MARKET_BOUNDS.max - 1);
const OFFER_LOW = pct(OFFER_BOUNDS.min);
const OFFER_HIGH = `${OFFER_BOUNDS.max} veces`;
const FEE = money(BOOKING_FEE);
const PLAN_DISCOUNTS = `semanal ${pct(RECURRING_DISCOUNT.weekly)}, cada dos semanas ${pct(RECURRING_DISCOUNT.biweekly)}, mensual ${pct(RECURRING_DISCOUNT.monthly)}, trimestral ${pct(RECURRING_DISCOUNT.quarterly)}`;

// ════════════════════════════════════════════════════════════════════════════
// 1. TÉRMINOS DE USO
// ════════════════════════════════════════════════════════════════════════════
const TERMS_OF_USE_ES: ContractTranslation = {
  title: `Términos de uso de ${BRAND.name}`,
  appliesTo: `Toda persona que visita el sitio web o la app de ${BRAND.name}, crea una cuenta, obtiene un precio o reserva un servicio.`,
  summary: [
    "Debe tener 18 años o más para usar la app y reservar servicios.",
    `${BRAND.name} es la empresa con la que usted trata. Nosotros sugerimos el precio, reservamos, gestionamos y garantizamos el trabajo. Profesionales independientes y verificados hacen el trabajo.`,
    "Nuestra IA sugiere precios y responde preguntas. Puede cometer errores. Usted puede ofrecer su propio precio dentro de ciertos límites. El precio firme es el que aparece en su factura.",
    "Le enviamos mensajes de texto y correos electrónicos sobre sus trabajos. Puede dejar de recibir correos de publicidad en cualquier momento, y responder STOP para dejar de recibir mensajes de texto.",
    "Sea honesto y respetuoso. No haga mal uso de la app, de nuestros profesionales ni de la información de otras personas.",
    "Si tenemos un problema, primero hablamos. Si no podemos resolverlo en 30 días, un árbitro neutral decide, una persona a la vez. El tribunal de reclamos menores siempre es una opción.",
    "Puede excluirse del arbitraje dentro de los 30 días después de crear su cuenta, enviándonos un correo electrónico.",
    "Se aplican las leyes de Michigan.",
  ],
  sections: numbered([
    ["Aceptación de estos términos", p(
      `Estos Términos de uso son un contrato entre usted y ${US}. Cubren nuestro sitio web, nuestras apps móviles, su cuenta, nuestro asistente de IA y los mensajes que le enviamos (en conjunto, "la app").`,
      "Al usar la app, crear una cuenta o reservar un servicio, usted acepta estos términos. Cada reserva también tiene su propio Acuerdo de servicio, que forma parte del mismo trato. Si reserva para un negocio, también puede aplicarse el Acuerdo de servicios para empresas.",
      "Si no está de acuerdo, por favor no use la app.",
    )],
    ["Quién puede usar la app", p(
      "Debe tener al menos 18 años y la capacidad legal de firmar un contrato. Puede reservar para usted, su familia o un negocio en cuyo nombre esté autorizado a actuar.",
      "Si reserva para otra persona (por ejemplo, uno de sus padres o un inquilino), usted promete que tiene su permiso. Usted sigue siendo responsable del pago y de cumplir estos términos.",
      "Nuestros servicios no son para niños. No recopilamos a sabiendas información de niños menores de 13 años.",
    )],
    ["Su cuenta", p(
      ul(
        "Denos información verdadera y actualizada: su nombre, teléfono, correo electrónico y dirección de servicio.",
        "Mantenga en privado su contraseña y sus códigos de inicio de sesión. No comparta su cuenta.",
        "Usted es responsable de las reservas y la actividad en su cuenta.",
        `Avísenos de inmediato si cree que otra persona usó su cuenta: ${CONTACT}.`,
        "Una persona, una cuenta. No cree cuentas adicionales para volver a obtener promociones.",
      ),
      "Puede cerrar su cuenta en cualquier momento comunicándose con nosotros. Las reservas ya pagadas siguen rigiéndose por su Acuerdo de servicio.",
    )],
    ["Cómo funciona la plataforma", p(
      `${BRAND.name} es una empresa de servicios que funciona con una red de profesionales independientes. Cuando usted reserva, contrata con nosotros. Nosotros sugerimos un precio (y usted puede ofrecer otro dentro de ciertos límites), programamos el trabajo, elegimos a un profesional calificado, revisamos el trabajo y lo respaldamos con nuestra garantía.`,
      "El trabajo en sí lo hacen negocios de servicios independientes, asegurados y con verificación de antecedentes (\"profesionales\"). Los profesionales no son nuestros empleados. Ellos deciden cómo hacer el trabajo, dentro del alcance por el que usted pagó.",
      "Algunos servicios, como los traslados y los trabajos de oficios con licencia, deben ser realizados por una empresa que tenga una licencia especial. En esos casos, reservamos una empresa con licencia para usted. Los términos adicionales de ese servicio (un \"anexo\") explican quién hace qué.",
      "Podemos rechazar cualquier reserva. Por ejemplo, si el trabajo está fuera de nuestra zona, es inseguro, es ilegal o no es algo que podamos hacer bien.",
    )],
    ["Precios, cotizaciones y nuestra IA", p(
      "Usamos software, incluida la inteligencia artificial (IA), para sugerir precios, responder preguntas, analizar fotos, programar profesionales y revisar trabajos.",
      "Precio sugerido y \"proponga su precio\": para cada trabajo le mostramos un precio sugerido. Se basa en los detalles que usted nos da, en nuestras tarifas estándar y en lo que los profesionales de su zona realmente han aceptado por trabajos similares. Usted puede reservar a ese precio u ofrecer un precio diferente dentro de los límites que se muestran. Los profesionales deciden si aceptan un trabajo al precio ofrecido, así que una oferta más baja puede tardar más o puede no ser aceptada. El Acuerdo de servicio explica los precios sugeridos, las ofertas, el cargo de reserva, las contraofertas de los profesionales y cómo aumentar su oferta.",
      "La IA puede cometer errores. Un precio sugerido, un rango de precios, una respuesta en el chat o un estimado a partir de fotos no es una promesa. El precio firme es el precio de su factura: el precio que usted aceptó y pagó al reservar, más cualquier aumento o contraoferta de un profesional que usted haya aceptado. Si el trabajo resulta ser diferente a lo que usted describió, el Acuerdo de servicio explica cómo funciona una orden de cambio.",
      "Algunos trabajos requieren que un profesional los vea primero (una visita al lugar gratuita). Una cotización firme después de una visita al lugar es válida por 14 días.",
      "Por favor, no confíe en nuestra IA para consejos médicos, legales, de seguridad, de impuestos o financieros. En emergencias como fugas de gas, incendios, inundaciones con riesgo eléctrico o problemas médicos, llame primero al 911 o a su compañía de servicios públicos.",
      "Si cree que un precio está mal, pregúntenos antes de pagar. Lo revisaremos. Si cometimos un error evidente en el precio, podemos corregirlo antes de que empiece el trabajo, y usted puede cancelar con reembolso total.",
    )],
    ["Pagos", p(
      "Los pagos los procesa Stripe, nuestro proveedor de pagos. Los datos de su tarjeta van directamente a Stripe. No guardamos el número completo de su tarjeta.",
      "Al guardar una tarjeta, usted nos permite cobrarle las reservas que haga, los saldos pendientes de depósitos, los aumentos de su oferta y las contraofertas de profesionales que usted acepte, las órdenes de cambio y los materiales aprobados, los planes recurrentes a los que se inscriba, las membresías, las propinas que decida dar y los cargos descritos en el Acuerdo de servicio (como un cargo por cancelación tardía).",
      "Los reembolsos se devuelven al método de pago original. Los montos de tarjetas de regalo y créditos se devuelven a su saldo de tarjeta de regalo o de crédito.",
      "Los términos propios de Stripe también se aplican a su pago.",
    )],
    ["Mensajes que le enviamos", p(
      "Al darnos su número de teléfono y su correo electrónico, usted acepta que podemos comunicarnos con usted, incluso por mensajes de texto automatizados, sobre:",
      ul(
        "Sus reservas: confirmaciones, horas de llegada, el nombre de su profesional, ubicación en tiempo real, fotos, recibos y facturas.",
        "Su cuenta: códigos de inicio de sesión, alertas de seguridad y problemas de pago.",
        "Atención al cliente y controles de calidad, incluida una breve encuesta después de un trabajo.",
      ),
      "Estos mensajes sobre sus trabajos son parte del servicio. No puede desactivarlos todos mientras tenga una reserva activa, pero puede elegir recibirlos por correo electrónico en lugar de texto comunicándose con nosotros.",
      "Correos de publicidad: podemos enviarle ofertas, recordatorios de temporada y seguimientos de cotizaciones guardadas. Cada correo de publicidad tiene un enlace para cancelar la suscripción con un clic. Cancelar la suscripción no detiene los mensajes sobre sus trabajos.",
      "Mensajes de texto de publicidad: solo enviamos textos de publicidad si usted los acepta por separado. Dar su consentimiento no es una condición para comprar nada.",
      "Mensajes de texto: responda STOP para dejar de recibir textos, o HELP para obtener ayuda. Pueden aplicarse tarifas de mensajes y datos. La frecuencia de los mensajes varía según sus reservas.",
      "Notificaciones push: puede desactivarlas en la configuración de su teléfono.",
      "Idioma: enviamos mensajes en inglés o en español, según el idioma que usted elija. Puede cambiarlo en su cuenta.",
      "Las llamadas y los chats con atención al cliente pueden grabarse o guardarse para fines de calidad y capacitación. Nuestra IA puede ayudar a redactar o responder mensajes.",
    )],
    ["Calificaciones y reseñas", p(
      "Después de un trabajo, le pedimos que lo califique. También le pedimos a cada cliente que nos califica que considere dejar una reseña pública en Google. Se lo pedimos a todos, estén contentos o no. Nunca pagamos por reseñas ni ofrecemos nada a cambio de una reseña positiva.",
      "Por favor, sea honesto y justo. No publique reseñas falsas, de odio o amenazantes, ni que compartan información privada de alguien (como la dirección de la casa o el número de teléfono de un profesional).",
      "Nunca le impedimos publicar una reseña honesta, y nada en estos términos limita su derecho a hacerlo.",
      "Podemos eliminar calificaciones o contenido que no cumplan estos términos. No editamos reseñas honestas para cambiar su sentido.",
    )],
    ["Contenido que usted comparte", p(
      "Usted sigue siendo dueño de las fotos, notas, mensajes y reseñas que comparte (\"su contenido\").",
      "Usted nos da una licencia para usar su contenido con el fin de prestar y mejorar el servicio: para poner precio y planificar trabajos, compartir con su profesional lo necesario, revisar la calidad, capacitar a nuestro personal y nuestro software, resolver disputas y cumplir obligaciones legales. Esta licencia es mundial, gratuita y dura mientras la necesitemos para esos fines.",
      "Nunca publicamos fotos de su casa o propiedad, ni su nombre, en nuestra publicidad sin su permiso. Si publica una reseña pública en nuestro sitio, podemos mostrarla con su nombre y la inicial de su apellido.",
      "Comparta solo contenido que tenga derecho a compartir. No suba fotos de otras personas sin su permiso.",
    )],
    ["Lo que no debe hacer", p(
      "Al usar la app, usted acepta no:",
      ul(
        "Violar la ley, ni pedirle a un profesional que viole la ley o una norma de seguridad.",
        "Acosar, amenazar, discriminar o maltratar a los profesionales, a nuestro personal o a cualquier otra persona.",
        "Dar información falsa, reservar a nombre de otra persona sin permiso ni usar una tarjeta robada.",
        "Abusar de las promociones, los referidos, las tarjetas de regalo o nuestra garantía (por ejemplo, con muchas cuentas, referidos falsos o reclamos de daños falsos).",
        "Contratar directamente a un profesional que conoció a través de nosotros para evitar nuestras tarifas (vea el Acuerdo de servicio).",
        "Copiar, extraer datos de forma automatizada (scraping), revender o aplicar ingeniería inversa a la app, ni usar bots para reservar u obtener datos.",
        "Interferir con la seguridad de la app ni intentar entrar en cuentas o sistemas que no son suyos.",
        "Usar la app para enviar spam o para recopilar información personal de profesionales o clientes.",
        "Intentar engañar a nuestra IA para que dé precios o respuestas que no cumplan nuestras reglas.",
      ),
      "Podemos limitar, suspender o cerrar las cuentas que no cumplan estas reglas.",
    )],
    ["Funciones de ubicación", p(
      "Si usted lo permite, la app usa la ubicación de su dispositivo para completar su dirección y mostrar servicios cercanos. Puede desactivarlo en la configuración de su dispositivo.",
      "Mientras un profesional va en camino hacia usted, le mostramos su ubicación en tiempo real. Esta se comparte solo para ese trabajo, solo mientras el profesional va en camino o está en el trabajo, y solo con usted y nuestro equipo.",
      "Por favor, no comparta con otras personas la ubicación en tiempo real de un profesional ni la use para ningún otro fin.",
    )],
    ["Privacidad", p(
      "Nuestra Política de privacidad explica qué información recopilamos y cómo la usamos y compartimos. Forma parte de estos términos. Nunca vendemos su información personal.",
      "Con su profesional compartimos solo lo que necesita para hacer el trabajo, como su nombre, la dirección, las indicaciones de acceso y las fotos.",
    )],
    ["Nuestra propiedad intelectual", p(
      `La app, nuestro nombre y logotipo, nuestros precios y herramientas de precios, nuestros textos, diseños y software pertenecen a ${BRAND.legalName} o a quienes nos otorgan licencias. Le damos un derecho limitado, personal e intransferible de usar la app para obtener y gestionar servicios. No puede copiar ni usar nuestra marca o contenido para ningún otro fin sin nuestro permiso por escrito.`,
      "Si nos envía ideas o comentarios, podemos usarlos sin deberle nada.",
    )],
    ["Servicios de otras empresas", p(
      "La app usa y enlaza a servicios operados por otras empresas, como Stripe (pagos), Google (mapas y reseñas), tiendas de apps, proveedores de mensajes de texto y correo electrónico, y proveedores de IA. Sus términos y políticas de privacidad se aplican al uso que usted haga de ellos. No somos responsables de sus servicios, pero los elegimos con cuidado.",
    )],
    ["Exenciones de responsabilidad", p(
      "Nos esforzamos por mantener la app funcionando y con información correcta. Pero la app se ofrece \"tal cual\" y \"según disponibilidad\". No prometemos que siempre esté disponible, sin errores o segura.",
      "Nuestras promesas sobre el trabajo en sí están en el Acuerdo de servicio y su garantía. En la medida en que la ley lo permita, no ofrecemos ninguna otra garantía sobre la app, incluidas las garantías implícitas de comerciabilidad, idoneidad para un fin determinado y no infracción.",
      "Algunos estados no permiten estas exenciones, por lo que es posible que algunas no se apliquen a usted.",
    )],
    ["Límites a nuestra responsabilidad", p(
      "En la medida en que la ley lo permita:",
      ul(
        "No somos responsables de daños indirectos, especiales, incidentales, consecuentes o punitivos, ni de pérdida de ganancias, pérdida de datos o pérdida de negocios, que resulten de su uso de la app.",
        "Para reclamos sobre la app en sí (no sobre un trabajo), nuestra responsabilidad total se limita a la cantidad mayor entre $100 o lo que usted nos pagó en los 6 meses anteriores al reclamo.",
        "Los reclamos sobre un trabajo se rigen por el Acuerdo de servicio de ese trabajo y sus límites.",
      ),
      "Nada en estos términos limita la responsabilidad por nuestro fraude, nuestra negligencia grave o conducta intencional, la muerte o lesiones personales causadas por nuestra negligencia, ni cualquier otra cosa que la ley no nos permita limitar.",
    )],
    ["Su responsabilidad por mal uso", p(
      `Si usted hace mal uso de la app, no cumple estos términos o la ley, o nos da información falsa, y eso causa un reclamo contra ${BRAND.name}, nuestro equipo o un profesional, usted acepta cubrir los costos razonables de ese reclamo, incluidos honorarios razonables de abogados. Esto no se aplica a reclamos causados por nuestra propia culpa.`,
    )],
    ["Resolución de disputas: primero hable con nosotros", p(
      `La mayoría de los problemas se resuelven rápido. Antes de iniciar cualquier reclamo formal, usted y nosotros aceptamos intentar resolverlo de manera informal. Envíe un \"Aviso de disputa\" por escrito por correo electrónico a ${BRAND.supportEmail} (asunto: Notice of Dispute). Incluya su nombre, sus datos de contacto, el número de reserva si lo hay, lo que pasó y lo que usted quiere. Nosotros enviaremos el nuestro al correo electrónico de su cuenta.`,
      "Ambos intentaremos de buena fe llegar a un acuerdo durante 30 días después de recibido el aviso. Si usted lo pide, hablaremos por teléfono o videollamada. Ninguna de las partes puede iniciar un arbitraje o una demanda hasta que terminen los 30 días, y los plazos para presentar el reclamo se suspenden durante este período.",
    )],
    ["Arbitraje individual obligatorio", p(
      "Si no podemos resolverlo de manera informal, usted y nosotros aceptamos que cualquier disputa sobre la app, estos términos, una reserva, un servicio, nuestros mensajes o nuestra relación se decidirá mediante arbitraje individual obligatorio (arbitration: un proceso privado ante un árbitro neutral), no en un tribunal. Esto incluye las disputas sobre si esta sección se aplica, salvo lo que se indica más abajo.",
      ul(
        "Quién lo administra: la American Arbitration Association (AAA), según sus Reglas de Arbitraje para Consumidores (Consumer Arbitration Rules). Si la AAA no puede o no quiere, las partes eligen otro proveedor neutral, o lo elegirá un tribunal.",
        "Dónde: por video o por teléfono, o en persona en el condado donde usted vive o donde se prestó el servicio, según usted elija. Los reclamos de $25,000 o menos pueden decidirse solo con documentos escritos si usted lo desea.",
        "Costos: usted no paga más de lo que pagaría por presentar un caso en un tribunal. Nosotros pagamos todos los demás costos de presentación, administración y honorarios del árbitro de la AAA, a menos que el árbitro determine que su reclamo era frívolo o se presentó con un propósito indebido.",
        "Facultades: el árbitro puede otorgar la misma reparación individual que podría otorgar un tribunal, incluidos daños y honorarios de abogados cuando la ley lo permita. Cualquier reparación se aplica solo a usted y a nosotros.",
        "La Ley Federal de Arbitraje (Federal Arbitration Act) rige esta sección.",
      ),
      "En el arbitraje no hay juez ni jurado, y la revisión por parte de un tribunal es limitada." + COUNSEL,
    )],
    ["Excepciones: reclamos menores y asuntos urgentes", p(
      "Cualquiera de las partes puede, en su lugar, presentar un reclamo individual en el tribunal de reclamos menores (small claims court), siempre que se mantenga allí y califique para ese tribunal.",
      "Cualquiera de las partes también puede acudir a un tribunal para detener el mal uso de la propiedad intelectual o el acceso no autorizado a la app.",
      "Nada de lo aquí dicho le impide presentar un asunto ante una agencia de gobierno (como el Fiscal General de Michigan) o ante su banco.",
    )],
    ["Sin demandas colectivas", p(
      "Usted y nosotros solo podemos presentar reclamos de forma individual, no como demandante ni como miembro de un grupo en una demanda colectiva, grupal o representativa. El árbitro no puede combinar los reclamos de más de una persona a menos que todos estén de acuerdo.",
      "Si un tribunal decide que esta regla contra demandas colectivas no puede aplicarse a un reclamo en particular, entonces ese reclamo (y solo ese reclamo) va a un tribunal, después de que termine el arbitraje individual de cualquier otro reclamo. El resto del acuerdo de arbitraje sigue aplicándose." + COUNSEL,
    )],
    ["Muchos reclamos similares (arbitraje masivo)", p(
      "Si se presentan 25 o más demandas de arbitraje similares contra nosotros (o por nosotros) por parte de los mismos abogados u organizaciones, o de abogados u organizaciones coordinados, dentro de 90 días, se tramitarán por lotes. La AAA las agrupará en lotes de hasta 50 reclamos, con un árbitro por lote cuando sea posible, y solo se tramita un lote a la vez. Los demás casos esperan, y los costos de presentación de los casos en espera no se pagan hasta que empiece su lote. Los plazos de esos reclamos se suspenden mientras esperan.",
      "Esto mantiene en marcha los reclamos de todos de manera justa y evita que la presión de los costos obligue a llegar a acuerdos. Un tribunal puede hacer cumplir esta sección." + COUNSEL,
    )],
    ["Su derecho a excluirse del arbitraje", p(
      `Usted puede excluirse del acuerdo de arbitraje dentro de los 30 días después de aceptar estos términos por primera vez (por ejemplo, cuando crea su cuenta o hace su primera reserva). Escriba a ${BRAND.supportEmail} con el asunto \"Arbitration Opt-Out\" e incluya su nombre, el correo electrónico o teléfono de su cuenta y una declaración clara de que se excluye.`,
      "Excluirse no cambia nada más en estos términos ni afecta su servicio. Si se excluye, las disputas irán a los tribunales que se describen más abajo.",
      "Si más adelante hacemos un cambio importante a la sección de arbitraje, usted puede rechazar ese cambio enviándonos un correo electrónico dentro de los 30 días posteriores al cambio. En ese caso, la versión anterior seguirá aplicándose a usted.",
    )],
    ["Leyes y tribunales de Michigan", p(
      "Las leyes de Michigan rigen estos términos y cualquier disputa, excepto cuando se aplique la ley federal (incluida la Ley Federal de Arbitraje). Si usted vive en otro estado, conserva cualquier derecho de protección al consumidor que le otorgue su estado y que no se pueda renunciar.",
      "Para cualquier asunto que vaya a un tribunal y no sea de reclamos menores, lo verán los tribunales estatales y federales del condado de Wayne, Michigan, a menos que la ley diga que usted puede demandar donde vive.",
      "Cualquier reclamo debe presentarse dentro de un año después de que surja, a menos que la ley exija un plazo más largo." + COUNSEL,
    )],
    ["Cambios a estos términos", p(
      "Podemos actualizar estos términos a medida que cambie el servicio o cambie la ley. Si un cambio es importante, se lo informaremos por correo electrónico o en la app al menos 14 días antes de que entre en vigor, a menos que la ley exija hacerlo antes o que sea para corregir un problema de seguridad.",
      "Los cambios no se aplican a reservas ya pagadas ni a disputas ya iniciadas. Si sigue usando la app después de que un cambio entre en vigor, acepta los nuevos términos. Si no está de acuerdo, puede cerrar su cuenta.",
    )],
    ["Cierre de su cuenta", p(
      "Puede dejar de usar la app y cerrar su cuenta en cualquier momento.",
      "Podemos suspender o cerrar su cuenta si no cumple estos términos, si sospechamos fraude o abuso, si usted actúa de forma insegura o abusiva con un profesional o con nuestro personal, o si dejamos de ofrecer el servicio. Si cerramos su cuenta sin que sea culpa suya, le reembolsaremos las reservas pagadas que aún no se hayan realizado y los saldos no usados de tarjetas de regalo.",
      "Las secciones que por su naturaleza deben seguir vigentes (como los pagos adeudados, la licencia sobre el contenido, las exenciones de responsabilidad, los límites de responsabilidad, la resolución de disputas y la ley aplicable) continúan después de que se cierre su cuenta.",
    )],
    ["Disposiciones generales", p(
      ul(
        "Estos términos, la Política de privacidad, cada Acuerdo de servicio y cualquier anexo de su servicio constituyen el acuerdo completo sobre la app.",
        "Si se determina que una parte no es aplicable, el resto sigue aplicándose, y esa parte se modifica solo lo necesario.",
        "Si no hacemos cumplir una regla de inmediato, igual podemos hacerla cumplir más adelante.",
        "Usted no puede transferir estos términos. Nosotros podemos transferirlos a una empresa que se haga cargo de nuestro negocio, avisándole a usted.",
        "No somos responsables de retrasos causados por hechos fuera de nuestro control, como tormentas, cortes de servicio o acciones del gobierno.",
        "Los títulos son solo para mayor comodidad. \"Incluido\" significa \"incluido, entre otros\".",
        "Si estos términos se traducen, la versión en inglés prevalece cuando haya una diferencia, en la medida en que la ley lo permita.",
      ),
    )],
    ["Contáctenos", p(
      `${BRAND.legalName} · ${BRAND.supportEmail} · ${BRAND.supportPhone}. Los avisos legales dirigidos a nosotros deben enviarse por correo electrónico a ${BRAND.supportEmail} con "Legal Notice" en el asunto, y además por correo postal si publicamos una dirección postal para avisos.`,
    )],
  ]),
};

// ════════════════════════════════════════════════════════════════════════════
// 2. ACUERDO DE SERVICIO (por reserva, impreso en cada factura)
// ════════════════════════════════════════════════════════════════════════════
const SERVICE_AGREEMENT_ES: ContractTranslation = {
  title: `${BRAND.legalName} — Acuerdo de servicio`,
  appliesTo: "Cada reserva. Usted lo acepta cuando reserva y paga, y aparece impreso en su factura.",
  summary: [
    `Usted reserva y le paga a ${BRAND.name}. Nosotros programamos, gestionamos y garantizamos el trabajo. Un profesional independiente, asegurado y con verificación de antecedentes hace el trabajo. Por favor, no le pague directamente a su profesional.`,
    `Le sugerimos un precio basado en lo que los profesionales cerca de usted realmente aceptan. Puede ofrecer un precio diferente dentro de ciertos límites, pero una oferta más baja puede tardar más o puede no ser aceptada. Usted paga por adelantado, y el precio incluye un cargo de reserva fijo de ${FEE}.`,
    "Mientras ningún profesional acepte, usted puede aumentar su oferta, y un profesional puede hacer una contraoferta con un precio más alto. Pagar más siempre es su decisión, y solo le cobramos la diferencia. El trabajo adicional solo se hace después de que usted lo apruebe y lo pague.",
    `Cancele o cambie su reserva gratis hasta 24 horas antes de su horario de llegada. Con menos de 24 horas, o si su profesional no puede entrar, nos quedamos con un cargo de ${money(LATE_CANCEL_FEE)} y le reembolsamos el resto.`,
    `¿Algo no quedó bien? Avísenos dentro de ${BRAND.guaranteeDays} días con fotos. Enviamos al profesional de vuelta sin costo, le damos un servicio gratis o le hacemos un reembolso.`,
    "Reporte cualquier daño dentro de 72 horas con fotos. Todo profesional tiene seguro de responsabilidad civil, y nosotros manejamos el reclamo con usted.",
    "Por favor, dé acceso, asegure a sus mascotas y objetos de valor, infórmenos sobre peligros y tenga a un adulto (18+) en casa para los trabajos dentro del hogar, a menos que acordemos otra cosa. El respeto es mutuo: el acoso o la discriminación terminan el trabajo.",
    "Reserve los trabajos futuros con los profesionales que conozca a través de nosotros, para que este acuerdo y nuestra garantía lo sigan protegiendo.",
  ],
  sections: numbered([
    ["Con quién contrata usted", p(
      `Usted contrata con ${US}. Nosotros sugerimos el precio, programamos, gestionamos y garantizamos su trabajo. El trabajo lo hace un negocio de servicios independiente, asegurado y con verificación de antecedentes, que nosotros seleccionamos y cuya calidad revisamos ("su profesional"). Los profesionales son negocios independientes, no nuestros empleados.`,
      "Usted nos paga a nosotros. Nosotros le pagamos a su profesional después de que el trabajo esté hecho y pase nuestro control de calidad. Por favor, no le pague directamente a su profesional. Los pagos hechos fuera de la app no están cubiertos por este acuerdo ni por nuestra garantía.",
      "Favoritos y pedir a un profesional: usted puede marcar a un profesional (o a un miembro del equipo de una empresa de profesionales) como favorito, o pedir a un profesional que ya tuvo cuando vuelva a reservar. Entonces le ofrecemos su trabajo primero a ese profesional durante unas horas (menos si el trabajo es pronto). Es una primera oportunidad, no una promesa: si no puede tomarlo en ese tiempo, lo toma otro profesional verificado, y su precio, fecha y garantía no cambian. Pedir a un miembro del equipo es una solicitud a esa empresa; la empresa decide a quién envía.",
      "Algunos servicios tienen términos adicionales (un \"anexo\"), por ejemplo traslados, entregas médicas, cuidado de mascotas, eventos, construcción y remodelaciones, mandados, acarreo, limpieza de autos (detailing), y servicios para el hogar y el jardín. Si su servicio tiene un anexo, este forma parte de este acuerdo.",
    )],
    ["Qué incluye (alcance)", p(
      "Haremos el trabajo descrito en su factura. Nuestro precio sugerido se basa en los detalles y las fotos que usted nos da. Por favor, describa el trabajo de forma completa y honesta. Todo lo que no aparezca en la factura no está incluido.",
      "Si agrega notas, las leemos, pero una nota no agrega trabajo a menos que se refleje en el precio y en la factura.",
    )],
    ["Cambios en el lugar (órdenes de cambio)", p(
      "A veces un trabajo resulta diferente cuando llega el profesional. Por ejemplo: más artículos o más área, daños ocultos, condiciones inseguras o problemas de acceso.",
      "Cuando eso pasa, su profesional hará una pausa y le enviaremos una orden de cambio en la app con un nuevo precio, basado en nuestras tarifas estándar. El trabajo adicional se hace solo después de que usted apruebe la orden de cambio y la pague.",
      "Si no la aprueba, su profesional terminará el trabajo que usted ya pagó si se puede hacer de forma segura y correcta. Si el trabajo original no se puede hacer, le reembolsaremos la parte que no se pueda hacer, menos cualquier cargo por visita que se explica más abajo.",
      "Por favor, no le pida a su profesional que haga trabajo adicional \"por fuera\". El trabajo que no esté en su factura o en una orden de cambio aprobada no está cubierto por nuestra garantía ni por nuestra coordinación de seguros.",
    )],
    ["Precio", p(
      ul(
        `Precio sugerido: antes de reservar, le mostramos un precio sugerido. Se basa en los detalles y las fotos que usted nos da, en nuestras tarifas estándar y en lo que los profesionales de su zona han aceptado recientemente por trabajos similares. Lo que aceptan los profesionales puede subir o bajar el precio sugerido, pero solo dentro de límites fijos (no más de ${MARKET_DOWN} por debajo ni ${MARKET_UP} por encima de nuestro precio estándar).`,
        `Proponga su precio: usted puede reservar al precio sugerido u ofrecer un precio diferente, desde el ${OFFER_LOW} del precio sugerido hasta ${OFFER_HIGH} el precio sugerido. Los profesionales deciden si aceptan un trabajo al precio ofrecido. Una oferta más baja puede tardar más en ser aceptada, o puede no ser aceptada nunca, y le avisamos antes de reservar cuando una oferta es baja. Sea cual sea el precio que elija, lo paga por adelantado, de la misma forma.`,
        `Cargo de reserva: cada reserva incluye un cargo de reserva fijo de ${FEE} (en los planes recurrentes, en cada visita). Ya está incluido en el precio que le mostramos y aparece en su factura. ${BRAND.name} se lo queda para operar las reservas, los pagos y la atención al cliente. No forma parte del pago de su profesional, y los códigos promocionales, los ahorros de ${HANDLED_PLUS.name} y otros descuentos no lo reducen. No hay cargo de reserva en los trabajos rehechos gratis ni en los servicios de cortesía.`,
        "Precio por adelantado: usted ve el precio completo antes de reservar. Incluye la mano de obra, los materiales indicados y el cargo de reserva. El precio de su factura (su oferta, más cualquier aumento o contraoferta que usted haya aceptado) es el precio que usted paga por ese alcance.",
        `Cargo de prioridad: los trabajos que empiezan dentro de las ${RUSH_HOURS} horas siguientes a la reserva tienen un cargo de prioridad (urgencia) de ${pct(RUSH_SURCHARGE)}, que se muestra antes de reservar. Los miembros de ${HANDLED_PLUS.name} no lo pagan.`,
        `Planes recurrentes: los planes tienen un descuento en cada visita (${PLAN_DISCOUNTS}), que se muestra en su factura.`,
        `Revisión de precio por IA: nuestra IA puede revisar sus detalles y fotos y ajustar el precio sugerido, pero solo dentro de límites fijos (no más de ${pct(AI_MAX_CUT)} por debajo ni ${pct(AI_MAX_RAISE)} por encima de nuestro precio estándar). Si un trabajo necesita más que eso, en su lugar le ofrecemos una visita al lugar gratuita. Usted siempre ve el precio final antes de pagar.`,
        "Su presupuesto: si nos dice su presupuesto, lo usamos para sugerirle opciones. No cambia el precio a menos que acordemos un alcance diferente o que usted decida ofrecer un precio diferente.",
        "Visitas al lugar: los estimados en el lugar son gratuitos. Una cotización firme después de una visita al lugar es válida por 14 días.",
        "Errores de precio: si hay un error evidente en un precio, podemos corregirlo antes de que empiece el trabajo. Si usted no acepta el precio corregido, recibe un reembolso total.",
      ),
    )],
    ["Contraofertas de profesionales y aumento de su oferta", p(
      "Después de que usted reserva y paga, ofrecemos su trabajo a profesionales calificados a su precio. Cada profesional ve exactamente cuánto se le pagaría y decide si lo acepta.",
      ul(
        "Contraofertas: un profesional puede responder con el pago que sí aceptaría. Entonces le mostramos el precio total que esa contraoferta significa para usted. Usted puede aceptarla: le cobramos solo la diferencia y le damos el trabajo a ese profesional con el pago que pidió. O puede seguir esperando a su precio. Mientras usted decide, otros profesionales todavía pueden aceptar su trabajo a su precio original. Las contraofertas terminan en cuanto cualquier profesional acepta el trabajo.",
        "Aumentar su oferta: mientras ningún profesional acepte su trabajo, usted puede aumentar su precio. Le cobramos solo la diferencia, a su tarjeta guardada o mediante un enlace de pago. Luego su trabajo se ofrece de nuevo a los profesionales al precio más alto.",
        "Todavía sin profesional: si ningún profesional ha aceptado su trabajo después de un tiempo, podemos sugerirle un precio más alto, una sola vez. Nunca está obligado a aumentarlo. Puede seguir esperando o cancelar según \"Cambios de fecha y cancelaciones\" más abajo. Si no encontramos un profesional para su fecha, le ofreceremos otro horario o un reembolso total.",
      ),
      "El precio que usted termine pagando (su oferta, más cualquier aumento o contraoferta que haya aceptado) pasa a ser el precio de su factura. Los reembolsos, las cancelaciones y nuestra garantía se aplican a ese total.",
    )],
    ["Pago", p(
      "El precio completo se paga por adelantado para programar el trabajo, a menos que se aplique un depósito (vea más abajo). Los pagos los procesa Stripe. Puede pagar con tarjeta, y los trabajos más grandes pueden pagarse por transferencia bancaria (ACH) donde la ofrezcamos.",
      "Si usted aumenta su oferta o acepta la contraoferta de un profesional, le cobramos solo la diferencia, a su tarjeta guardada o mediante un enlace de pago que le enviamos.",
      `Cómo se reparte su precio: del precio que usted paga, ${BRAND.name} se queda con el cargo de reserva y una comisión, y a su profesional se le paga el resto. Los códigos promocionales y los ahorros de ${HANDLED_PLUS.name} salen de nuestra parte, nunca del pago de su profesional.`,
      "A su profesional solo le pagamos nosotros. Por favor, no le pague a su profesional en efectivo ni de ninguna otra forma.",
    )],
    ["Depósitos para trabajos grandes y eventos", p(
      `Para trabajos que requieren una visita al lugar, eventos y trabajos de ${money(DEPOSIT.threshold)} o más, es posible que pueda pagar un depósito en lugar del precio completo.`,
      ul(
        `La mayoría de los trabajos: un depósito de ${pct(DEPOSIT.share)} del precio (mínimo ${money(DEPOSIT.minimum)}). El saldo se cobra a su tarjeta guardada ${DEPOSIT.balanceDaysBefore} días antes del trabajo.`,
        `Eventos: un depósito de ${pct(DEPOSIT.eventShare)} (mínimo ${money(DEPOSIT.minimum)}). El saldo se cobra ${DEPOSIT.eventBalanceDaysBefore} días antes del evento.`,
        "Si un trabajo se reserva con tan poca anticipación que no queda tiempo para cobrar un saldo, se paga completo.",
        "Si el cobro del saldo falla, le avisaremos y lo intentaremos de nuevo. Si no se paga a más tardar el día antes del trabajo, podemos cancelarlo, y se aplican los términos de cancelación.",
      ),
      "Su factura muestra el depósito, el saldo y la fecha en que se cobrará. Al reservar con depósito, usted nos autoriza a cobrar el saldo a su tarjeta guardada en esa fecha.",
    )],
    ["Materiales y piezas", p(
      "Los precios incluyen los materiales indicados. Si su trabajo necesita piezas o materiales que no están incluidos, se cobran al costo, sin recargo, según el recibo de la tienda.",
      `Le avisamos antes de cobrar a su tarjeta. Las compras de más de ${MATERIALS_OK} necesitan primero su aprobación. Usted siempre puede decir que no; en ese caso, su profesional hará lo que se pueda hacer sin ellos.`,
      "Los recibos se guardan en su trabajo dentro de la app. Si devuelve una pieza sin usar que compramos para usted, recibe lo que la tienda nos reembolse.",
    )],
    ["Impuestos", p(
      "Los impuestos que se apliquen a su servicio, si los hay, aparecen en su factura. La mayoría de los servicios para el hogar no pagan el impuesto sobre las ventas de Michigan, pero algunos artículos (como materiales que se le venden a usted, alquileres o servicios de comida) sí pueden pagarlo.",
    )],
    ["Propinas", p(
      `Las propinas son opcionales y nunca se esperan. Si da una propina en la app después del trabajo, el 100% de la propina va para su profesional. Nosotros no nos quedamos con nada. Lo máximo que puede dar de propina en un trabajo en la app es ${money(TIP_MAX)}.`,
      "Las propinas no se reembolsan una vez pagadas a su profesional, salvo en casos de fraude o error.",
    )],
    ["Planes recurrentes", p(
      "Si elige un plan recurrente (por ejemplo, limpieza semanal o cuidado mensual del césped), cada visita se cobra a su tarjeta guardada antes de esa visita. Puede cambiar, pausar o cancelar su plan en cualquier momento antes del próximo cobro, en la app o comunicándose con nosotros. No hay un compromiso a largo plazo a menos que su factura lo indique (por ejemplo, una temporada de nieve prepagada).",
      `Cada cobro usa el precio del plan vigente en ese momento. Si usted es miembro de ${HANDLED_PLUS.name}, volvemos a verificar su membresía antes de cada cobro. Si su membresía terminó, el descuento para miembros se suspende a partir de la siguiente visita.`,
      "Podemos cambiar los precios de los planes con al menos 14 días de aviso. Usted puede cancelar antes de que se aplique el nuevo precio.",
    )],
    ["Programación y llegada", p(
      `Usted elige una fecha y un horario de llegada (mañana, mediodía, tarde o flexible), con hasta ${BRAND.bookingHorizonDays} días de anticipación. Algunos días estamos cerrados, como lo muestra el calendario. Su profesional llega dentro del horario reservado. El horario es para la llegada; después, el trabajo toma el tiempo que necesite.`,
      "Le enviamos el nombre de su profesional y su ubicación en tiempo real mientras va hacia usted. Si su profesional se retrasa o no puede ir, le avisaremos y le enviaremos a otro profesional calificado o le ofreceremos un nuevo horario. Si no podemos, recibe un reembolso total.",
      "Las reservas para el mismo día y \"lo antes posible\" dependen de que haya un profesional disponible. Si no podemos cubrir una a tiempo, le ofreceremos el siguiente horario disponible o un reembolso total.",
    )],
    ["Sus plazos", p(
      "Si nos dice la fecha para la cual necesita el trabajo terminado, la tomamos como meta y planificamos para cumplirla. No es una garantía a menos que confirmemos esa fecha por escrito (en la app o en su factura).",
      "El clima, los permisos, los materiales, otros proveedores y el acceso pueden afectar los plazos. Lo mantendremos informado.",
    )],
    ["Cambios de fecha y cancelaciones", p(
      ul(
        "Más de 24 horas antes de su horario de llegada: cambie la fecha o cancele gratis, con reembolso total. Puede hacerlo en su cuenta.",
        `Con menos de 24 horas: nos quedamos con un cargo por cancelación tardía de ${money(LATE_CANCEL_FEE)} y le reembolsamos el resto. Para cambiar una reserva con menos de 24 horas, envíenos un mensaje; le ayudaremos si podemos.`,
        `Sin acceso: si su profesional llega y no puede entrar, o no hay nadie cuando se necesita que alguien esté, nos quedamos con un cargo por visita de ${money(LATE_CANCEL_FEE)} y le reembolsamos el resto, o cambiamos la fecha.`,
        "Proyectos cotizados (como remodelaciones, calefacción y aire acondicionado [HVAC], trabajos de árboles y eventos): una vez que se piden los materiales o se reservan los proveedores, se aplican los términos de cancelación de la cotización o del anexo. Se descuentan los costos no reembolsables que ya pagamos por usted, y se los mostramos.",
        `Cambiar a una fecha dentro de las próximas ${RUSH_HOURS} horas puede agregar el cargo de prioridad.`,
        "Si nosotros cancelamos: usted recibe un reembolso total.",
      ),
      "Parte del cargo con el que nos quedamos va para su profesional, que reservó ese tiempo.",
    )],
    ["Lo que necesitamos de usted", p(
      ul(
        "Acceso: deje entrar a su profesional, o denos instrucciones de acceso claras (códigos, llaves, portón, estacionamiento).",
        "Servicios básicos: agua, electricidad y calefacción funcionando donde el trabajo los necesite.",
        "Áreas de trabajo despejadas: retire del paso los artículos personales, los objetos frágiles y los vehículos cuando pueda.",
        "Mascotas: mantenga a las mascotas aseguradas lejos del área de trabajo, a menos que su servicio sea de cuidado de mascotas.",
        "Un lugar seguro para trabajar: sin amenazas, armas a la vista, actividades ilegales ni condiciones inseguras.",
        "Infórmenos sobre peligros antes del trabajo: moho, asbesto, plagas, objetos punzocortantes, pisos inseguros, animales agresivos, alguien enfermo en la casa, daños recientes por incendio o inundación, o cualquier otra cosa que un profesional deba saber.",
        "Una persona de 18 años o más debe estar presente en los trabajos dentro del hogar, a menos que acordemos otra cosa por escrito (por ejemplo, una llave o una caja de seguridad para llaves en el caso de limpieza). Los niños deben estar bajo su supervisión, no la del profesional.",
        "Detalles correctos: la dirección, el tamaño y las fotos que nos da son la base de nuestro precio.",
      ),
    )],
    ["Nuestra garantía de dejarlo bien", p(
      `Si algo no quedó bien, avísenos dentro de ${BRAND.guaranteeDays} días después del trabajo, con fotos. Haremos una de las siguientes cosas, la que resuelva el problema de manera justa, a nuestra elección:`,
      ul(
        "Enviar a su profesional (u otro profesional) de vuelta para arreglarlo sin costo;",
        "Darle un servicio de cortesía; o",
        "Reembolsarle todo o parte del precio.",
      ),
      "Los reembolsos se devuelven a su método de pago original. Por favor, permítanos intentar arreglarlo antes de que otra persona rehaga el trabajo. No podemos cubrir el costo del trabajo de otra empresa que no hayamos aprobado primero.",
      "La garantía no cubre:",
      ul(
        "Mal uso, descuido, accidentes o cambios hechos por otra persona después del trabajo.",
        "El desgaste normal, el clima y las cosas que vuelven con el tiempo (como la maleza, la suciedad o la nieve).",
        "Problemas que existían antes del trabajo (condiciones preexistentes), como manchas viejas, grietas, madera podrida o piezas desgastadas, a menos que el trabajo fuera para arreglarlos.",
        "Los materiales o productos que usted proporcionó, y su funcionamiento.",
        "Resultados estéticos sobre los que le avisamos antes del trabajo (por ejemplo, una mancha que quizás no salga por completo).",
        "Trabajos o artículos que no aparecen en su factura ni en una orden de cambio aprobada.",
        "Trabajos pagados fuera de la app.",
      ),
      "Algunos servicios tienen una garantía más larga (por ejemplo, una garantía de mano de obra de un año en remodelaciones y trabajos de oficios con licencia). El anexo de su servicio lo indicará. Las garantías del fabricante de los productos pasan a usted.",
    )],
    ["Daños a la propiedad", p(
      "Todo profesional tiene seguro de responsabilidad civil general. Si algo se daña, por favor repórtelo dentro de 72 horas con fotos. No tire el artículo dañado hasta que lo hayamos visto, a menos que no sea seguro conservarlo.",
      "Trabajaremos con usted, con su profesional y con la aseguradora del profesional para resolver el reclamo de manera justa, y lo mantendremos informado. En reclamos pequeños, podemos pagarle directamente y encargarnos nosotros de la aseguradora.",
      "En la medida en que la ley lo permita, nuestra responsabilidad total por cualquier trabajo se limita a lo que usted pagó por ese trabajo, más cualquier cantidad recuperada del seguro del profesional por su reclamo. No somos responsables de pérdidas indirectas o consecuentes, como pérdida de ingresos, pérdida de uso o angustia emocional, excepto cuando la ley no permita este límite.",
      "Este límite no se aplica a lesiones o muerte causadas por nuestra negligencia, ni a nuestra negligencia grave, fraude o conducta intencional." + COUNSEL,
    )],
    ["Objetos de valor, efectivo y artículos privados", p(
      "Por favor, guarde el efectivo, las joyas, las armas de fuego, los medicamentos, los documentos importantes y otros objetos de valor, o guárdelos bajo llave, antes de que llegue su profesional. A los profesionales se les indica que no abran cajones, cajas fuertes ni áreas privadas a menos que el trabajo lo requiera.",
      "No somos responsables del efectivo, las joyas ni los objetos de valor que se dejen a la vista en el área de trabajo, excepto cuando la pérdida sea causada por deshonestidad o negligencia nuestra o del profesional. Si algo desaparece, avísenos de inmediato; lo tomamos en serio y cooperaremos con la policía.",
    )],
    ["Fotos, ubicación en tiempo real y mensajes", p(
      "Su profesional toma fotos de antes y después para nuestro control de calidad. Las usamos solo para control de calidad, atención al cliente y resolución de reclamos. Las guardamos de forma privada y nunca las publicamos sin su permiso.",
      "Mientras su profesional va en camino, compartimos con usted su ubicación en tiempo real. También podemos registrar cuándo llega y cuándo se va.",
      "Usted acepta recibir mensajes de texto y correos electrónicos sobre sus trabajos. Responda STOP para dejar de recibir textos. Nuestros Términos de uso explican nuestros mensajes en detalle.",
      "Por favor, no grabe a los profesionales con cámaras ocultas en espacios privados. Las cámaras normales de seguridad del hogar están bien; avísenos si graban sonido.",
    )],
    ["Seguridad y respeto", p(
      "Todos merecen un trabajo seguro y respetuoso. Tenemos tolerancia cero con el acoso, las amenazas, la violencia o la discriminación por raza, color, religión, sexo, orientación sexual, identidad de género, origen nacional, edad, discapacidad o cualquier otra característica protegida. Esto se aplica en ambos sentidos: de los profesionales hacia usted, y de usted hacia los profesionales.",
      ul(
        "Si se siente inseguro o un profesional actúa de forma inapropiada, aléjese del área y comuníquese con nosotros de inmediato. En una emergencia, llame al 911.",
        "Un profesional puede detener el trabajo e irse si el lugar es inseguro, si lo amenazan o acosan, o si le piden hacer algo ilegal o inseguro.",
        "Podemos cancelar o detener un trabajo, o cerrar una cuenta, por razones de seguridad. Si la razón es su conducta o un lugar inseguro del que no nos informó, se aplican los términos de cancelación tardía. De lo contrario, reembolsamos el trabajo no realizado.",
        "Podemos rechazar o detener trabajos que impliquen peligros como asbesto, moho, desechos peligrosos, objetos punzocortantes, plagas o estructuras inseguras, y reembolsar la parte no realizada.",
      ),
    )],
    ["Reservar a través de nosotros", p(
      "Por favor, reserve los trabajos futuros con los profesionales que conozca a través de nosotros, para que este acuerdo, nuestros requisitos de seguro y nuestra garantía lo sigan protegiendo.",
      `Durante 12 meses después de conocer a un profesional a través de ${BRAND.name}, por favor no contrate a ese profesional directamente, fuera de la app, para el mismo tipo de servicios. Los profesionales aceptan la misma regla. Si esto ocurre, podemos cerrar su cuenta y cobrarle un cargo razonable por referencia para cubrir la presentación (la cantidad mayor entre ${money(250)} o el 20% del primer año de trabajo directo).` + COUNSEL,
      "Los profesionales son negocios independientes, no nuestros empleados. Usted tampoco los contrata como sus empleados; usted nos compra un servicio a nosotros.",
    )],
    ["Disputas de cargos con su tarjeta (contracargos)", p(
      "Si hay algún problema con un cargo o un trabajo, por favor comuníquese primero con nosotros. Por lo general podemos resolverlo más rápido que su banco, y nuestra garantía existe para eso.",
      "Si usted disputa un cargo con su banco, compartiremos nuestros registros con el banco, incluidos su acuerdo firmado, fotos y mensajes. Mientras haya una disputa abierta sobre un trabajo que ya estamos tratando de resolver, podemos pausar nuevas reservas en su cuenta hasta que se resuelva. Si la disputa se decide a nuestro favor, el cargo original se mantiene.",
      "Nada de lo aquí dicho limita sus derechos según las reglas de las redes de tarjetas o la ley.",
    )],
    ["Su derecho a cancelar ventas en el hogar (regla de 3 días de Michigan)", p(
      "La Ley de Ventas por Solicitación en el Hogar de Michigan (Home Solicitation Sales Act) le da derechos adicionales cuando una venta se hace en su casa. Si usted firma o acepta un contrato de más de $25 en su casa, después de que nuestro profesional o representante lo visite allí en persona (por ejemplo, una visita al lugar gratuita para una remodelación, un trabajo de calefacción y aire acondicionado [HVAC] o un trabajo de árboles), puede cancelarlo sin ninguna penalidad ni obligación hasta la medianoche del tercer día hábil después de aceptarlo." + COUNSEL,
      "AVISO DE CANCELACIÓN. Usted puede cancelar esta transacción, sin ninguna penalidad ni obligación, dentro de los tres días hábiles a partir de la fecha en que se acordó. Si cancela, cualquier pago que haya hecho y cualquier documento que haya firmado se le devolverán dentro de los 10 días hábiles después de que recibamos su aviso de cancelación. Para cancelar, envíe una copia firmada y fechada de un aviso de cancelación, o cualquier otro aviso por escrito, o envíe un correo electrónico o un mensaje en la app, a " + `${BRAND.legalName}, ${BRAND.supportEmail}` + ", a más tardar a la medianoche del tercer día hábil después de la fecha de la transacción. También puede tocar \"Cancelar\" en la reserva dentro de su cuenta. El aviso es válido desde el momento en que se envía." + COUNSEL,
      "Si usted nos pide por escrito que empecemos el trabajo antes por una emergencia real (por ejemplo, una tubería rota o falta de calefacción en invierno), podemos empezar antes, y usted puede renunciar a este derecho solo en la forma que permita la ley." + COUNSEL,
      "Este derecho es adicional a nuestra cancelación gratuita normal con más de 24 horas de anticipación a su horario de llegada.",
    )],
    ["Trabajo seguro con plomo en casas antiguas", p(
      "Si su casa se construyó antes de 1978, puede tener pintura a base de plomo. Para trabajos de pintura, remodelación y reparaciones que alteren superficies pintadas, usamos profesionales certificados según la regla de Renovación, Reparación y Pintura (RRP) de la EPA y prácticas de trabajo seguras con plomo. Le daremos el folleto de la EPA \"Renovate Right\" antes de que empiece el trabajo. Por favor, díganos el año en que se construyó su casa.",
    )],
    ["Trabajos con licencia y permisos", p(
      "Los trabajos de plomería, electricidad, calefacción y aire acondicionado (HVAC), pintura, remodelación, servicios de comida (catering), camiones de comida, transporte de pasajeros y mensajería médica los hacen solo profesionales o empresas que tienen la licencia que el trabajo requiere. Usted puede pedir ver una licencia.",
      "Cuando se requiere un permiso o una inspección, el profesional con licencia lo tramita, y el costo aparece en su factura. Por favor, deje entrar a los inspectores. No hacemos trabajos que requieren permiso sin tenerlo.",
    )],
    ["Clima y hechos fuera de nuestro control", p(
      "Algunas cosas están fuera del control de cualquiera: tormentas, nieve, hielo, calor o frío extremos, inundaciones, cortes de luz, cierres de carreteras, emergencias públicas, huelgas, escasez de suministros y órdenes del gobierno. Si alguna de estas cosas retrasa o detiene un trabajo, cambiaremos la fecha sin costo o reembolsaremos la parte no realizada. Ninguna de las partes incumple el acuerdo por un retraso causado por estos hechos.",
      "La remoción de nieve, el cuidado del césped, la recolección de hojas, el lavado a presión, la pintura exterior, la limpieza de canaletas y otros trabajos al aire libre pueden pasar al siguiente día seguro debido al clima. Le avisaremos en cuanto lo sepamos.",
    )],
    ["Ley aplicable y disputas", p(
      `Por favor, comuníquese primero con nosotros a ${BRAND.supportEmail} o al ${BRAND.supportPhone}. La mayoría de los problemas se resuelven en un día hábil.`,
      "Este acuerdo se rige por las leyes de Michigan. Cualquier disputa se resuelve según la sección de resolución de disputas de nuestros Términos de uso, incluidos hablar primero durante 30 días, el arbitraje individual obligatorio, la opción de reclamos menores, la renuncia a demandas colectivas y su derecho a excluirse. Si un trabajo se realiza en otro estado, también se aplican las leyes de protección al consumidor de ese estado que no se pueden renunciar.",
    )],
    ["Términos generales", p(
      ul(
        "Transferencia: usted no puede transferir este acuerdo sin nuestro consentimiento. Nosotros podemos cederlo a una empresa que se haga cargo de nuestro negocio, o hacer que otro profesional calificado haga el trabajo.",
        "Divisibilidad: si se determina que alguna parte no es aplicable, el resto sigue aplicándose, y esa parte se modifica solo lo necesario para que sea aplicable.",
        "Sin renuncia: si no hacemos cumplir un término de inmediato, igual podemos hacerlo cumplir más adelante.",
        "Avisos: enviamos los avisos al correo electrónico o teléfono de su reserva. Usted nos los envía a " + BRAND.supportEmail + ".",
      ),
    )],
    ["Acuerdo completo y su firma", p(
      "Su factura, este Acuerdo de servicio, cualquier anexo de su servicio, cualquier orden de cambio aprobada y nuestros Términos de uso (incluido su acuerdo de arbitraje) constituyen el acuerdo completo para este trabajo. Si se contradicen, se aplica este orden: una orden de cambio aprobada, luego la factura, luego el anexo, luego este acuerdo, luego los Términos de uso.",
      "Aceptar estos términos en línea cuando reserva es su firma electrónica, con el mismo efecto que firmar en papel. Guardamos un registro de cuándo y desde dónde los aceptó. Puede ver e imprimir este acuerdo y su factura en cualquier momento en su cuenta.",
    )],
  ]),
};

export const CUSTOMER_ES_A: Record<string, ContractTranslation> = {
  "terms-of-use": TERMS_OF_USE_ES,
  "service-agreement": SERVICE_AGREEMENT_ES,
};
