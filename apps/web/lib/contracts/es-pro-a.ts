/*
 * FILE    : apps/web/lib/contracts/es-pro-a.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_0048 UTC
 * UPDATED : 2026-10-04_2204 UTC — first looks (business account pros, customer favorites, crew member requests) and the open job board ("Jobs near you"); agreement v5 / Service Agreement v7.
 * UPDATED : 2026-10-03_0115 UTC — rechazar ofertas nunca afecta pago, nivel ni orden de ofertas.
 * UPDATED : 2026-10-03_0152 UTC — market pricing (el cliente propone el precio dentro de un rango de mercado; el
 *           profesional acepta, rechaza o hace una contraoferta; pago = precio − cargo de reserva − comisión
 *           escalonada): secciones 3, 4, 8, 10 y el resumen, igual que pro.ts.
 * PURPOSE : Spanish (neutral Latin-American, formal "usted") translation of PRO_AGREEMENT
 *           ("pro-agreement") from ./pro.ts. Same summary bullets and sections, same order and
 *           numbering; numbers come from the same @handled/core constants so both languages
 *           always render the same figures. The English version controls.
 *           TEMPLATES — not legal advice; have counsel review before use.
 * UPDATED : 2026-10-03_1311 UTC — niveles: vía rápida a Pro+ (portafolio + trabajo de prueba pagado revisado).
 */
import {
  AGREEMENT_VERSION,
  BOOKING_FEE,
  BRAND,
  COMMISSION,
  COVERAGES,
  LATE_CANCEL_FEE,
  LOCATION_FRESH_MIN,
  ON_CALL_MAX_HOURS,
  PROBATION,
  PRO_POLICY_DEFAULTS,
  PRO_REFERRAL,
  PRO_TIERS,
  FAST_TRACK,
  STATS_WINDOW_DAYS,
  TAKE_MAX,
  TAKE_MIN,
  TIP_MAX,
  TRADES,
  TRADE_PROFILES,
  money,
  necThreshold,
  splitJob,
  type CoverageKey,
} from "@handled/core";
import { DEACTIVATION_RULES } from "./pro";
import type { ContractTranslation } from "./types";

// ─── Helpers (mirror the non-exported ones in ./pro.ts) ─────────────────────────

const COUNSEL = " [Confirmar con un abogado.]";
const P = PRO_POLICY_DEFAULTS;
const L = BRAND.legalName;
const N = BRAND.name;
const D = DEACTIVATION_RULES;
const pct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;
const cents = (n: number) => `$${n.toFixed(2)}`;
const label = (id: string) => TRADES.find((t) => t.id === id)?.label ?? id;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
const tradesRequiring = (k: CoverageKey) => Object.entries(TRADE_PROFILES).filter(([, p]) => p.requires.includes(k)).map(([id]) => label(id));
const highGlTrades = Object.entries(TRADE_PROFILES).filter(([, p]) => p.glMin > 1_000_000).map(([id, p]) => `${money(p.glMin)} para ${label(id)}`);
const NEC_YEAR = 2026;
/** Ejemplo de pago de la sección 8 (igual que en pro.ts): un servicio de $100 más el cargo de reserva. */
const EX_PRICE = 100 + BOOKING_FEE;
const EX = splitJob(EX_PRICE);
const COMMISSION_TEXT = `${pct(COMMISSION.minRate)} en trabajos de ${money(COMMISSION.from)} o menos, y sube de forma pareja hasta ${pct(COMMISSION.maxRate)} en trabajos de ${money(COMMISSION.to)} o más`;

const tierLines = PRO_TIERS.map((t) =>
  t.payoutBoost
    ? `• ${t.name} — ${t.min.jobs}+ trabajos completados, calificación de ${t.min.rating}★+ y ${pct(t.min.onTime)}+ de puntualidad: se suma +${pct(t.payoutBoost)} del precio del trabajo a cada pago, y se le da prioridad sobre los niveles inferiores para recibir ofertas.`
    : `• ${t.name} — todos los profesionales activos. Pago estándar indicado en cada oferta.`,
).concat(`• Vía rápida: un profesional con ${FAST_TRACK.minYears}+ años en el oficio puede enviar un portafolio de trabajos anteriores y hacer un trabajo de prueba pagado que revisamos personalmente; si se aprueba, empieza en ${PRO_TIERS.find((t) => t.id === FAST_TRACK.tier)!.name} y lo conserva durante sus primeros ${FAST_TRACK.graceJobs} trabajos, y después mientras su calificación y su puntualidad cumplan los mínimos de ese nivel. Solicitarla es opcional; nunca afecta las ofertas.`).join("\n");

// ─── Contrato de Contratista Independiente ──────────────────────────────────────

export const PRO_ES_A: Record<string, ContractTranslation> = {
  "pro-agreement": {
    title: `${L} — Contrato de Contratista Independiente (v${AGREEMENT_VERSION})`,
    appliesTo: `Todo profesional (negocio independiente) que acepta trabajos a través de ${N}; se firma en el portal de profesionales antes de la primera oferta y se vuelve a firmar cada vez que cambia la versión.`,
    summary: [
      "Usted maneja su propio negocio. Usted elige qué ofertas aceptar, cuándo y dónde trabaja, cómo hace el trabajo y quién le ayuda. Puede trabajar para cualquier otra persona o empresa, incluidos nuestros competidores.",
      "Cada oferta muestra el alcance, la fecha y su pago exacto antes de que usted diga que sí. Usted puede aceptar, rechazar o hacer una contraoferta con el pago que quiere. Los clientes pagan por adelantado. Los pagos se envían gratis cada semana; el retiro instantáneo es opcional por una pequeña comisión.",
      `Su pago es el precio del trabajo menos el cargo de reserva de ${money(BOOKING_FEE)} que paga el cliente (es nuestro) y nuestra comisión: ${COMMISSION_TEXT}. Los descuentos y promociones nunca reducen su pago. Las propinas son 100% suyas. Usted nunca paga comisiones por clientes potenciales ni suscripciones.`,
      `Corrija los problemas de mano de obra dentro de ${BRAND.guaranteeDays} días sin pago adicional. Un reembolso solo se descuenta de su pago cuando su mano de obra lo causó — con un tope igual al pago de ese trabajo, con aviso y la oportunidad de responder.`,
      "Mantenga al día su seguro, licencias y documentos. Las ofertas se pausan automáticamente cuando alguno vence y se reanudan cuando se renueva.",
      "No se lleve fuera de la plataforma, durante 12 meses, a los clientes que conoció a través de nosotros. No hay cláusula de no competencia.",
      "Solo podemos dejar de enviarle ofertas por los motivos objetivos de la Política de Desactivación, con aviso por escrito y una apelación revisada por una persona. El dinero que usted ha ganado siempre se paga.",
      "Los desacuerdos pasan primero por una conversación informal y luego por arbitraje individual — puede excluirse del arbitraje dentro de los 30 días posteriores a la firma.",
    ],
    sections: [
      {
        h: "1. Quiénes somos y qué cubre este contrato",
        p: `Este contrato es entre ${L} ("${N}", "nosotros") y usted — la persona o empresa que lo firma ("usted", "profesional"). Cubre todo trabajo que usted acepte a través del sitio web, la aplicación o el portal de profesionales de ${N}.\n\nEl contrato completo está formado por: este documento; el Código de Conducta para Profesionales de ${N}; la Política de Desactivación de Profesionales; el Aviso de Verificación de Antecedentes; el Consentimiento de Ubicación y Comunicaciones; cualquier anexo de oficio para los oficios que usted realiza; y la orden de trabajo de cada trabajo que usted acepte. Si se contradicen, un anexo de oficio prevalece sobre este documento para ese oficio, y este documento prevalece sobre una orden de trabajo.`,
      },
      {
        h: "2. Usted maneja un negocio independiente",
        p: `Usted es un contratista independiente que maneja su propio negocio. No es nuestro empleado, socio, coinversionista ni agente. Usted no puede firmar contratos en nuestro nombre, y nosotros no podemos firmarlos en el suyo.\n\nComo negocio independiente, usted:\n• elige si acepta cualquier oferta, sin ninguna penalidad por decir que no más allá de las reglas objetivas y publicadas de la sección 15;\n• fija sus propios días y horas de trabajo, días libres, zona de servicio, distancia de manejo y límite diario de trabajos — nunca le enviamos una oferta fuera de esos límites, salvo que usted active "De guardia" para trabajos del mismo día;\n• decide cómo hacer el trabajo: sus métodos, el orden de las tareas, sus herramientas, equipo, productos, vehículo y ayudantes;\n• puede trabajar para otras empresas y clientes al mismo tiempo, incluidos nuestros competidores;\n• puede anunciar y hacer crecer su propio negocio con su propio nombre;\n• proporciona y paga sus propias herramientas, equipo, vehículo, teléfono, suministros y gastos del negocio (excepto los materiales que reembolsamos según la sección 11).\n\nNo exigimos uniformes ni ropa con nuestra marca. Podemos ofrecerle un gafete de identificación opcional de ${N} para que los clientes puedan confirmar quién es usted; usarlo es decisión suya. No exigimos capacitación, excepto la capacitación de seguridad o cumplimiento que la ley exige para su oficio (por ejemplo HIPAA para entregas médicas, capacitación sobre patógenos transmitidos por la sangre para muestras, certificación de la EPA de trabajo seguro con plomo para casas antiguas, certificación de manipulador de alimentos). Nuestra verificación de habilidades antes de empezar es una verificación única de que usted está calificado, no una capacitación.\n\nEvaluamos el trabajo por sus resultados — el alcance que el cliente pagó, terminado, de forma segura y en el día acordado — no por cómo usted llega a ellos.\n\nCuando la ley le otorga derechos que este contrato no puede quitarle, esos derechos aplican.`,
      },
      {
        h: "3. Lo que hacemos nosotros y lo que hace usted",
        p: `Lo que hace ${N}:\n• promociona los servicios y consigue clientes;\n• contrata con el cliente, le muestra al cliente un precio sugerido y cobra por adelantado el precio acordado;\n• envía ofertas de trabajo a los profesionales que califican para ellas;\n• se encarga de la programación, los recordatorios, los mensajes de los clientes y la atención al cliente;\n• respalda la garantía de satisfacción del cliente (volver a hacer el trabajo, un servicio adicional gratis o un reembolso), y paga de nuestra parte la repetición del trabajo cuando usted decide no hacerla;\n• le paga por el trabajo completado según el calendario indicado abajo, con un estado de cuenta por cada trabajo.\n\nLo que hace usted:\n• realiza el trabajo que acepta, de forma segura, legal y conforme al estándar de la orden de trabajo;\n• mantiene al día su seguro, licencias, certificaciones, formularios de impuestos y documentos;\n• se comunica con el cliente y con nosotros a través de la aplicación sobre el acceso, los horarios y cualquier cosa que cambie el trabajo;\n• toma las fotos de antes y después que demuestran que el trabajo está hecho;\n• paga sus propios impuestos, ayudantes y proveedores.\n\nUna aclaración honesta sobre los precios: nosotros no decidimos por nuestra cuenta cuánto paga un trabajo. Le mostramos al cliente un precio sugerido, basado en nuestras tarifas estándar y en lo que los profesionales de la zona realmente aceptan, y el cliente puede ofrecer un precio diferente dentro de límites fijos. Luego usted decide por cuánto trabaja: cada oferta muestra su pago exacto, y usted puede aceptarlo, rechazarlo o hacer una contraoferta con el pago que quiere (sección 4). El precio de cada trabajo se fija con ese ir y venir — la oferta del cliente y la decisión de los profesionales de aceptar, rechazar o hacer una contraoferta — no solo por nosotros. Nos quedamos con el cargo de reserva del cliente y con una comisión publicada que varía según el tamaño del trabajo (sección 8); no la cambiamos para profesionales individuales. Las contraofertas se hacen a través de la aplicación; usted no negocia con el cliente directamente ni fuera de la plataforma.${COUNSEL}`,
      },
      {
        h: "4. Ofertas de trabajo: siempre es su decisión",
        p: `Las ofertas son opcionales. Usted puede aceptar, rechazar o ignorar cualquier oferta, por cualquier motivo o sin motivo. Algunas ofertas se envían a varios profesionales a la vez y el primero que acepta se queda con el trabajo; una oferta que otro profesional acepta primero nunca cuenta en su contra.\n\nQuién recibe una oferta depende de reglas objetivas de elegibilidad: usted está activo, su oficio y especialidades coinciden, el trabajo está dentro de su distancia de manejo y en un día y horario en que usted trabaja (o está De guardia hoy), su límite diario de trabajos no está lleno, su seguro, coberturas requeridas, licencias y verificación de antecedentes están al día, y — mientras esté en período de prueba — el trabajo está dentro del límite de tamaño del período de prueba (sección 9).\n\nCuando un cliente recurrente al que usted atiende tiene otra visita, o un cliente al que usted atendió necesita que se repita un trabajo, le ofrecemos ese trabajo primero a usted, en exclusiva, durante un tiempo determinado antes que a nadie más (actualmente 24 horas para visitas recurrentes y 12 horas para repeticiones). Usted puede dejarlo pasar; entonces se ofrece de la forma normal.\n\nOtras primeras oportunidades y la bolsa de trabajos abierta. Una cuenta empresarial puede elegirlo como uno de sus profesionales, y un cliente puede marcarlo como favorito o pedirlo al volver a reservar; esos trabajos se le ofrecen primero a usted, por poco tiempo, antes que a nadie más (actualmente 2 horas para los profesionales de una cuenta empresarial, y 4 horas para el favorito de un cliente, o 1 hora si el trabajo es dentro de un día). Un cliente también puede pedir a un miembro específico de su equipo; es solo una solicitud, y usted decide a quién envía (Anexo de Equipo de Trabajo). Dejar pasar cualquier primera oportunidad no le cuesta nada. Los trabajos que nadie ha tomado unos 30 minutos después de las primeras ofertas aparecen en \"Trabajos cerca de usted\" en la app y en el portal de profesionales, para todo profesional que cumpla las reglas de elegibilidad anteriores; la dirección exacta se muestra solo después de aceptar. Tomar un trabajo de la lista se lo reserva por 15 minutos mientras lee la orden de trabajo, y es suyo solo cuando lo acepta allí; otro profesional puede aceptar primero. Ver o dejar pasar trabajos de la lista nunca cuenta en su contra.\n\nContraofertas. En lugar de aceptar o rechazar, usted puede hacer una contraoferta con el pago que quiere por el trabajo, hasta el doble del pago ofrecido. Le mostramos al cliente el precio que su contraoferta significa para él, y el cliente puede aceptarla o seguir esperando. Al hacer una contraoferta, usted se compromete a hacer el trabajo por el pago que pidió si el cliente la acepta mientras siga vigente; si la acepta, el cliente paga la diferencia y el trabajo se le asigna a usted automáticamente, como un trabajo aceptado según la sección 5, y le avisamos de inmediato. Mientras el cliente decide, otros profesionales todavía pueden aceptar la oferta original, y todas las contraofertas terminan en cuanto alguien acepta. Si el trabajo es más grande de lo descrito, envíenos un mensaje en lugar de hacer una contraoferta más alta.\n\nOfertas aumentadas. Mientras ningún profesional acepte, el cliente puede aumentar su precio. Entonces el trabajo se ofrece de nuevo con un pago más alto, y la nueva oferta muestra su nuevo pago exacto.\n\nRechazar, ignorar o hacer contraofertas nunca afecta su tarifa de pago, su nivel, el orden en que recibe ofertas ni su cuenta. No usamos tasas de aceptación para nada de eso.`,
      },
      {
        h: "5. Aceptar un trabajo: la orden de trabajo",
        p: `Antes de que usted acepte, la oferta muestra el servicio, el alcance, la fecha y el horario de llegada, la zona (no la dirección exacta), las fotos requeridas, las condiciones del trabajo y su pago exacto. Cuando usted acepta, se desbloquean la dirección completa y los datos de contacto del cliente y se crea una orden de trabajo.\n\nAceptar crea un compromiso obligatorio para ese trabajo: usted se compromete a hacer el trabajo descrito, dentro del horario de llegada indicado, conforme a este contrato. El horario de llegada es la cita del cliente, que usted eligió aceptar — es un resultado que le prometimos al cliente, no un horario que nosotros le imponemos.\n\nSi el trabajo requiere un depósito, no empiece hasta que la aplicación muestre "Pagado en su totalidad". Nunca reciba pagos directamente de un cliente.`,
      },
      {
        h: "6. Si necesita cancelar un trabajo que aceptó",
        p: `Surgen imprevistos. Si no puede hacer un trabajo que aceptó, devuélvalo en la aplicación lo antes posible para que su respaldo lo tome. Si va con retraso, envíele un mensaje al cliente por la aplicación antes de que empiece el horario.\n\nCancelar con ${D.freeCancelHours} horas o más de anticipación al horario de llegada es gratis y no queda registrado en su contra. Entre ${D.lateCancelHours} y ${D.freeCancelHours} horas es "poca anticipación": queda anotado, pero nunca cuenta para una advertencia. Cancelar dentro de las ${D.lateCancelHours} horas previas al horario de llegada es una "cancelación tardía". No presentarse sin cancelar es una "inasistencia". No hay ninguna tarifa ni cargo para usted por cancelar. Pero las cancelaciones tardías o inasistencias repetidas les fallan a los clientes, por lo que cuentan según las reglas objetivas de la Política de Desactivación (actualmente ${D.lateCancels} cancelaciones tardías o ${D.noShows} inasistencias en ${D.windowDays} días dan lugar primero a una advertencia por escrito). Las cancelaciones causadas por una emergencia, enfermedad, condiciones inseguras, mal tiempo severo o por el cliente no cuentan cuando usted nos indica el motivo.\n\nRespaldos. Cada trabajo tiene hasta tres profesionales de respaldo. Aceptar estar de respaldo es opcional: puede confirmar o pasar sin costo, y a un respaldo solo se le paga si lo llamamos, acepta y hace el trabajo — el pago, la calificación, el avance de nivel y los puntos de Recompensas siempre son para el profesional que realmente hace el trabajo.`,
      },
      {
        h: "7. La información de los clientes es confidencial",
        p: `Los nombres, direcciones, números de teléfono, correos electrónicos, códigos de acceso, notas y fotos de los clientes, y todo lo que usted vea u oiga en la casa o el negocio de un cliente, son confidenciales. Úselos solo para hacer ese trabajo. No los conserve después del trabajo, no los comparta, no los venda ni los use para ofrecerle sus servicios al cliente. Borre los datos de contacto del cliente de su propio teléfono y registros una vez terminados el trabajo y cualquier repetición, salvo que la ley le exija conservarlos.`,
      },
      {
        h: "8. Cómo se le paga",
        p: `• El pago se muestra primero. Cada oferta muestra su pago exacto. Eso es lo que se le paga por la orden de trabajo, más cualquier orden de cambio aprobada, materiales, propinas y beneficios. Si un cliente acepta su contraoferta, su pago es el que usted pidió en la contraoferta.\n• Cómo se calcula el pago. Pago = el precio acordado del trabajo, menos el cargo de reserva, menos nuestra comisión. El cargo de reserva (${money(BOOKING_FEE)} por reserva, o por visita en los planes recurrentes) lo paga el cliente además del precio del servicio y nos lo quedamos nosotros; nunca sale de su pago. Nuestra comisión es un porcentaje del precio del servicio (el precio sin el cargo de reserva) y varía según el tamaño del trabajo: ${COMMISSION_TEXT}. Así, los trabajos pequeños llevan una comisión pequeña, y cada dólar adicional de precio sigue aumentando su pago. Nuestra tasa de comisión siempre se mantiene entre el ${pct(TAKE_MIN)} y el ${pct(TAKE_MAX)}. Los pagos se redondean hacia abajo al dólar entero. Ejemplo: en un trabajo con precio de ${money(EX_PRICE)} (un servicio de ${money(EX_PRICE - BOOKING_FEE)} más el cargo de reserva), su pago es de ${money(EX.payout)}.\n• Bonos de nivel. Los bonos de nivel publicados (sección 15) se suman al pago.\n• Los clientes pagan por adelantado. Los clientes nos pagan antes de que usted sea enviado, así que usted nunca tiene que facturar ni cobrar.\n• Aprobación. Su pago se aprueba cuando usted marca el trabajo como completado y sus fotos de finalización pasan la revisión. La revisión de fotos verifica que se hizo el trabajo de la orden de trabajo; no le dice cómo hacerlo.\n• Pagos semanales. Los pagos aprobados (trabajos, pago por presentarse, estipendios, materiales, propinas, bonos y complementos aprobados, menos cualquier recuperación de pago según la sección 17) se envían automáticamente cada lunes, sin costo, a la cuenta bancaria a su nombre a través de Stripe.\n• Pago instantáneo (opcional). Usted puede retirar los pagos aprobados antes de tiempo por una comisión del ${pct(P.instantPay.feePct, 2)} (mínimo ${cents(P.instantPay.minFee)}), una vez que califique según las reglas publicadas. El pago semanal siempre es gratis.\n• Estados de cuenta. Usted recibe un estado de cuenta por cada pago que muestra cada trabajo, su pago y cualquier ajuste con su motivo.\n• Sin costos por trabajar. Usted nunca paga comisiones por clientes potenciales, cuotas de inscripción, suscripciones ni cargos por software.\n\nSi cree que un pago está mal, avísenos dentro de los 90 días siguientes al estado de cuenta y lo revisaremos con usted. No cumplir ese plazo no le quita ningún derecho que la ley le otorgue.`,
      },
      {
        h: "9. Período de prueba: sus primeros trabajos",
        p: `Sus primeros ${PROBATION.jobs} trabajos son trabajos de período de prueba. Se limitan a trabajos con un precio de ${money(PROBATION.maxJobPrice)} o menos, y en cada uno una persona revisa sus fotos de finalización y se hace una llamada de seguimiento al cliente antes de aprobar el pago. Esta es una verificación única de calidad sobre los resultados; agrega una breve demora a la aprobación, no un recorte al pago.`,
      },
      {
        h: "10. Descuentos, promociones y propinas",
        p: `Los descuentos, códigos promocionales, membresías, créditos por recomendación y tarjetas de regalo nunca reducen su pago. Su pago se basa en el precio de lista del trabajo (el precio acordado antes de cualquier código promocional o ahorro de membresía), y todo descuento sale de nuestra parte.\n\nLas propinas son 100% suyas. Los clientes pueden dar propina en la aplicación (hasta ${money(TIP_MAX)} por trabajo); le pasamos la propina completa en el siguiente pago y nosotros cubrimos la comisión de la tarjeta. Una propina en efectivo que un cliente ofrezca por su cuenta también es suya — solo nunca la pida ni condicione el servicio a ella.`,
      },
      {
        h: "11. Materiales y piezas",
        p: `En los oficios en los que aplica el reembolso de materiales, las piezas y materiales no incluidos en el precio del trabajo se reembolsan al costo contra un recibo detallado que se sube a la aplicación. Las compras de hasta ${money(P.materials.autoApproveUpTo)} se aprueban automáticamente; las mayores necesitan nuestra autorización previa. Los materiales que superen el ${pct(P.materials.maxShareOfPrice)} del precio del trabajo (o más de ${money(P.materials.shoppingMax)} en compras para mandados) necesitan primero una orden de cambio para el cliente. Le reembolsamos una vez que el cliente los haya pagado. Nunca alteramos sus recibos en su contra, y usted nunca paga los materiales del cliente con su pago.\n\nSi le pedimos que compre a través de un proveedor o proceso aprobado para un trabajo específico (por ejemplo, para que el cliente obtenga una garantía), la orden de trabajo lo indicará.`,
      },
      {
        h: "12. Cambios en el alcance",
        p: "Si encuentra más trabajo del que se reservó (una carga más grande, otra habitación, daños ocultos), detenga esa parte, actualice el alcance en la aplicación y dígale al cliente que le enviaremos una orden de cambio. Nosotros fijamos el precio de la diferencia, se lo enviamos al cliente para que lo apruebe y pague, y agregamos el pago adicional a su trabajo. Haga el trabajo adicional solo después de que la aplicación muestre que está pagado. El trabajo que usted haga fuera de la orden de trabajo sin una orden de cambio pagada no se paga, y usted no debe cobrárselo directamente al cliente.",
      },
      {
        h: "13. Cancelaciones tardías, falta de acceso y pago por presentarse",
        p: `Si el cliente cancela dentro de las 24 horas previas al horario de llegada, paga un cargo por cancelación tardía (actualmente ${money(LATE_CANCEL_FEE)}).\n\nSi usted llega y no puede entrar, toque "¿No puede entrar?" en la aplicación y espere 15 minutos mientras intentamos comunicarnos con el cliente. Si confirmamos la falta de acceso, el trabajo se cierra como falta de acceso y el cliente paga el cargo por cancelación tardía.\n\nEn ambos casos, mientras el pago por presentarse le aplique, usted recibe el monto publicado por presentarse (actualmente hasta ${money(P.showUpPay.amount)}) del cargo que nosotros conservamos, en su siguiente pago.`,
      },
      {
        h: "14. Beneficios del Programa para Profesionales",
        p: `Mientras cumpla las reglas de elegibilidad publicadas en su portal de profesionales, usted recibe:\n• Protección del pago — un reembolso que no sea causado por su mano de obra sale primero de nuestra parte. Solo reduce su pago en la cantidad que nuestra parte no alcance a cubrir.\n• Pago por presentarse — el monto publicado por presentarse cuando el cliente cancela tarde o hay una falta de acceso confirmada (sección 13).\n• Pago instantáneo — retire los pagos aprobados antes de tiempo por la comisión publicada, a través de una cuenta de Stripe a su nombre (sección 8).\n• Materiales al costo — sección 11.\n• Ayuda con seguros — cotizaciones a través de nuestros socios de seguros, y un estipendio único para seguros (actualmente ${money(P.insurance.stipend)}) después de su trabajo completado número ${P.insurance.afterJobs}.\n• Mínimo semanal garantizado — cuando lo ofrecemos, en los meses publicados, para los profesionales que califiquen y cumplan las reglas publicadas de disponibilidad y aceptación, sujeto a nuestra aprobación y al presupuesto semanal. Completa su semana hasta el mínimo publicado (actualmente ${money(P.guarantee.weeklyMinimum)}).\n• Bono por recomendar a un profesional — ${money(PRO_REFERRAL.bonus)} una vez que un profesional que usted recomendó complete ${PRO_REFERRAL.afterJobs} trabajos.\n\nPodemos cambiar las reglas de elegibilidad o los montos en adelante, con aviso en el portal. Los cambios nunca reducen nada que usted ya haya ganado, y un cambio aplica solo a los trabajos aceptados después de que entre en vigor.`,
      },
      {
        h: "15. Niveles, orden de las ofertas y sus cifras",
        p: `Los niveles se obtienen a partir de sus cifras reales y se recalculan automáticamente:\n${tierLines}\nLos aumentos de pago por nivel tienen un tope para que nuestra parte nunca baje del ${pct(TAKE_MIN)} del precio del trabajo.\n\nCuando varios profesionales califican para un trabajo, las ofertas se envían en un orden basado en medidas objetivas de los últimos ${STATS_WINDOW_DAYS} días:\n• calificación de los clientes;\n• tasa de aprobación de la revisión de fotos al primer intento;\n• tasa de repeticiones y reembolsos;\n• tasa de puntualidad (inicio antes del final del horario reservado);\n• distancia al trabajo, espacios libres ese día, experiencia, especialidades que coinciden, estar De guardia para trabajos del mismo día, y su nivel.\nA los profesionales nuevos no se les juzga por unos pocos trabajos: las tasas solo cambian cuando hay suficiente historial.\n\nEstas medidas afectan el orden en que usted ve las ofertas. Nunca cambian su tarifa de pago, salvo los aumentos por nivel publicados arriba. Usted puede ver sus propias cifras en el portal, y puede pedirnos que corrijamos cualquiera que esté mal — por ejemplo, un inicio tardío causado por el cliente.${COUNSEL}`,
      },
      {
        h: "16. Calidad, revisión de fotos y repeticiones",
        p: `Usted tomará fotos de antes y después de cada área en la que trabaje. Nosotros las revisamos (con ayuda de inteligencia artificial, y siempre con una persona en los trabajos del período de prueba y cuando la verificación automática no esté segura) para confirmar que se hizo el trabajo de la orden de trabajo.\n\nSi el trabajo que usted realizó no cumple el estándar acordado, usted regresará a corregirlo dentro de ${BRAND.guaranteeDays} días sin pago adicional. La repetición se le ofrece primero a usted. Si la rechaza o no responde a tiempo, enviamos a otro profesional y le pagamos de nuestra parte — no de su pago — aunque puede aplicar la sección 17 si el problema fue su mano de obra. Una repetición que el cliente solicite por algo fuera de la orden de trabajo original, o causada por otra persona, es un trabajo nuevo y se paga como tal.`,
      },
      {
        h: "17. Reembolsos y recuperación de pagos",
        p: `Un reembolso reduce su pago solo cuando su mano de obra (o la de sus ayudantes) lo causó, y en ese caso solo hasta el monto de su pago por ese trabajo. Los reembolsos por cualquier otro motivo — que el cliente cambie de opinión, un error nuestro de precio o de programación, algo fuera de la orden de trabajo o cosas fuera de su control — salen de nuestra parte.\n\nAntes de descontar de su pago un reembolso por mano de obra, le informaremos por escrito qué pasó y le mostraremos las pruebas (fotos, mensajes, la queja del cliente), y le daremos al menos 3 días hábiles para responder con su versión. Una persona toma la decisión. Si el pago ya se realizó, el monto se convierte en una recuperación de pago que se descuenta de pagos futuros; no tomaremos más de la mitad de ningún pago semanal individual para una recuperación de pago salvo que usted lo acepte, y nunca la tomamos de las propinas. Usted puede apelar una recuperación de pago de la misma manera que una decisión de desactivación.`,
      },
      {
        h: "18. Contracargos",
        p: "Si un cliente disputa un cargo a su tarjeta con su banco, su pago por ese trabajo puede retenerse mientras la disputa esté abierta. Defendemos las disputas usando el contrato firmado por el cliente, sus fotos y el registro del trabajo. Si ganamos, o si la disputa no está relacionada con su trabajo (por ejemplo, fraude con tarjeta o un problema de facturación), el pago retenido se libera en el siguiente ciclo de pagos semanal. Si perdemos debido a su mano de obra, aplica la sección 17, incluidos el aviso y la oportunidad de responder.",
      },
      {
        h: "19. Impuestos",
        p: `Usted es responsable de sus propios impuestos sobre la renta y de trabajo por cuenta propia, y de cualquier impuesto sobre ventas, uso o actividades de su negocio. Nosotros no retenemos impuestos. Usted nos dará un Formulario W-9 correcto y mantendrá al día su nombre legal, clasificación tributaria y dirección. Le reportamos los pagos en el Formulario 1099-NEC (u otro formulario requerido) cuando la ley lo exige — para pagos hechos en ${NEC_YEAR}, cuando sumen ${money(necThreshold(NEC_YEAR))} o más en el año.`,
      },
      {
        h: "20. Seguros",
        p: `Usted mantendrá, a su propio costo, mientras acepte trabajos:\n• Un seguro de responsabilidad civil general de al menos $1,000,000 por incidente y $2,000,000 en total${highGlTrades.length ? ` (más alto: ${list(highGlTrades)})` : ""}, que nombre a ${L} como asegurado adicional.\n• Seguro de auto para cualquier vehículo que use para los trabajos. Las pólizas de auto personales a menudo excluyen el uso comercial — asegúrese de que la suya lo cubra. El seguro de auto comercial (${COVERAGES.auto.detail.split(".")[0]}) es obligatorio para ${list(tradesRequiring("auto"))}.\n• Seguro de compensación para trabajadores para sus propios empleados cuando Michigan (o su estado) lo exija. Si no tiene empleados, firmará una declaración de que no tiene empleados y obtendrá cobertura antes de que alguien trabaje para usted en un trabajo de ${N}.\n• Las coberturas específicas de sus oficios, indicadas en su lista de verificación de incorporación — por ejemplo una fianza de fidelidad para ${list(tradesRequiring("bond"))}; seguro de responsabilidad de auto para transporte de pasajeros en el caso de transporte; seguro de responsabilidad por bebidas alcohólicas siempre que se sirva alcohol.\n\nUsted subirá certificados vigentes y nos avisará de inmediato si la cobertura se cancela, se reduce o vence. Verificamos las pólizas con las aseguradoras. Las ofertas se detienen automáticamente el día en que vence una póliza requerida y se reanudan en cuanto se verifica una renovación. Su seguro es el principal para su trabajo.`,
      },
      {
        h: "21. Licencias y permisos",
        p: `Usted tendrá toda licencia, registro y certificación que su oficio y cada trabajo exijan legalmente, a nombre de su negocio cuando la ley lo exija, y los mantendrá al día. El trabajo que requiere licencia (por ejemplo plomería, electricidad y HVAC) se asigna solo a profesionales con la licencia correspondiente. Usted tramitará los permisos requeridos como la parte con licencia y aprobará las inspecciones. Avísenos de inmediato si una licencia se suspende, se restringe o vence — las ofertas para ese oficio se detienen hasta que se renueve.`,
      },
      {
        h: "22. Verificación de antecedentes",
        p: "Antes de la activación, y periódicamente después (actualmente cada año, y cuando usted agrega un oficio que implica manejar), realizamos una verificación de antecedentes a través de nuestro proveedor de verificación, con su consentimiento por escrito por separado en el formulario independiente de divulgación y autorización de la FCRA del proveedor. Los oficios que implican manejar también incluyen una revisión del historial de manejo. Si algo en un informe pudiera afectar su elegibilidad, seguimos el proceso de acción adversa del Aviso de Verificación de Antecedentes: usted recibe una copia del informe y la oportunidad de explicarlo o disputarlo antes de cualquier decisión.",
      },
      {
        h: "23. Ayudantes y subcontratistas",
        p: `Usted puede usar ayudantes, empleados o subcontratistas. Usted los elige, los dirige, les paga y es totalmente responsable de su trabajo, conducta, salarios, impuestos, seguros (incluida la compensación para trabajadores) y del cumplimiento de este contrato. No son empleados ni contratistas de ${N}.\n\nPor la seguridad de los clientes, cualquier persona que vaya a entrar en la casa o el negocio de un cliente, o que vaya a manejar las mascotas, llaves, vehículo, espacios de niños o artículos médicos de un cliente, debe primero estar registrada en su cuenta y aprobar nuestra verificación de antecedentes. El trabajo que requiere licencia debe hacerlo o supervisarlo alguien que tenga la licencia requerida. Usted es responsable de cualquier reembolso o daño causado por sus ayudantes, igual que si usted mismo hubiera hecho el trabajo.`,
      },
      {
        h: "24. Seguridad e incidentes",
        p: "Usted seguirá las normas de OSHA y demás normas de seguridad que apliquen a su trabajo, usará el equipo de protección adecuado y usará su propio criterio en cuanto a la seguridad. Usted puede detener o rechazar cualquier trabajo, o cualquier parte de uno, que considere inseguro — avísenos en la aplicación y lo resolveremos con el cliente; una detención por seguridad nunca cuenta en su contra.\n\nInfórmenos dentro de las 24 horas (de inmediato en caso de emergencia — llame primero al 911): cualquier lesión, daño a la propiedad, accidente de vehículo, intervención de la policía, amenaza, acoso, mordedura de animal, o pérdida o robo de bienes o llaves del cliente. Notifique a su propia aseguradora según lo exija su póliza. Coopere con cualquier investigación y reclamación de seguro.",
      },
      {
        h: "25. Bienes, llaves, códigos y privacidad del cliente",
        p: "• Trate los bienes del cliente con cuidado. Informe de inmediato cualquier daño o rotura, con fotos — aunque crea que es menor.\n• Las llaves, códigos de cajas de seguridad, códigos de puertas y códigos de garaje se usan solo para ese trabajo, nunca se copian ni se comparten, y se devuelven o se borran al terminar el trabajo. Cierre todo como lo encontró.\n• Vaya solo a donde el trabajo lo requiera. No abra cajones, gabinetes, correspondencia ni dispositivos salvo que el trabajo lo requiera.\n• Las fotos son solo de las áreas de trabajo. Nunca fotografíe a personas, niños, documentos personales, correspondencia, pantallas, medicamentos, objetos de valor ni nada que no esté relacionado con el trabajo.\n• No publique fotos ni videos de la casa, el negocio o los bienes de un cliente en redes sociales ni en ningún otro lugar sin el consentimiento por escrito del cliente otorgado a través de nosotros.\n• Nunca lleve a un trabajo a nadie que no esté registrado como su ayudante.",
      },
      {
        h: "26. Compartir la ubicación",
        p: `La ubicación compartida en la aplicación se usa solo mientras usted está De guardia (hasta ${ON_CALL_MAX_HOURS} horas seguidas, a su elección) o tiene un trabajo ese día. La usamos para ofrecerle trabajos del mismo día cerca de usted y para mostrarle a su cliente una hora aproximada de llegada mientras usted va en camino o está en su trabajo. Los clientes ven solo una posición aproximada, y solo para su trabajo. Una ubicación con más de ${LOCATION_FRESH_MIN} minutos de antigüedad no se usa, y toda ubicación almacenada se borra después de 12 horas. No lo rastreamos en sus días libres ni cuando no está De guardia y no tiene trabajo. Los detalles están en el Consentimiento de Ubicación y Comunicaciones.`,
      },
      {
        h: "27. Comunicaciones",
        p: "Use la aplicación para los mensajes sobre trabajos con los clientes y con nosotros, para que quede un registro que lo proteja a usted y al cliente. Los mensajes pueden revisarse por motivos de seguridad, calidad, soporte y disputas. Nunca tiene que darle a un cliente su número de teléfono personal; donde haya llamadas con número enmascarado, las llamadas se hacen por ese medio. Los números de teléfono de los clientes que usted ve después de aceptar son solo para ese trabajo.",
      },
      {
        h: "28. Relaciones con los clientes: no captación y no elusión",
        p: `Invertimos dinero para conseguir a cada cliente. Durante 12 meses después de que se le presente por primera vez a un cliente a través de ${N}, usted no buscará ni aceptará trabajo de ese cliente para el mismo tipo de servicios fuera de la plataforma, ni lo animará a contratar sin pasar por nosotros. Esto aplica solo a los clientes que conoció a través de ${N} — nunca a sus propios clientes existentes ni a los clientes que lo encuentren por su cuenta sin ayuda nuestra.\n\nSi usted incumple esta regla, acepta pagarnos, como una estimación razonable de nuestra comisión perdida (no como una penalidad), un monto igual a nuestra parte (la diferencia entre el precio para el cliente y su pago en trabajos comparables de ${N}) sobre el trabajo desviado durante el resto de los 12 meses. Le mostraremos cómo lo calculamos, y usted puede disputarlo según la sección 37.${COUNSEL}`,
      },
      {
        h: "29. Sin cláusula de no competencia",
        p: `No hay cláusula de no competencia. Usted es libre de trabajar para cualquier otra plataforma, empresa o cliente, incluidos nuestros competidores, durante y después de este contrato.`,
      },
      {
        h: "30. Propiedad intelectual y fotos",
        p: `Las fotos que usted toma son suyas. Usted le otorga a ${N} una licencia no exclusiva y libre de regalías para usar las fotos de los trabajos para revisar la calidad, mantener el registro del trabajo, dar soporte al cliente, resolver disputas y mejorar nuestras herramientas de control de calidad. Las usaremos en publicidad solo con el consentimiento del cliente y quitando personas, direcciones y datos personales. Nuestro nombre, logotipo, aplicación, software, precios y contenido nos pertenecen; usted puede decir que está disponible en ${N}, pero no puede usar nuestra marca de una manera que sugiera que es nuestro empleado o que respaldamos su otro negocio.`,
      },
      {
        h: "31. Confidencialidad",
        p: `Además de la información de los clientes (sección 7), mantenga como confidencial cualquier información no pública sobre ${N} que conozca a través de la plataforma — como listas de clientes, reglas de precios y herramientas internas — y no la use salvo para hacer trabajos. Esto no le impide hablar sobre su propio pago o sus condiciones de trabajo, denunciar posibles violaciones de la ley ante una agencia del gobierno, ni nada más que la ley proteja.`,
      },
      {
        h: "32. Indemnización",
        p: `Usted defenderá, cubrirá y mantendrá indemne a ${N} frente a reclamaciones de terceros, pérdidas y honorarios legales razonables en la medida en que sean causados por: la negligencia, mala conducta o incumplimiento de este contrato o de la ley por parte de usted (o de sus ayudantes); las reclamaciones de sus ayudantes contra nosotros, incluidas las reclamaciones salariales o de clasificación de las personas que usted contrate; o sus obligaciones de impuestos y seguros.\n\nNosotros lo defenderemos, cubriremos y mantendremos indemne a usted frente a reclamaciones de terceros, pérdidas y honorarios legales razonables en la medida en que sean causados por: nuestra negligencia o mala conducta; errores en nuestra plataforma o en la información que le dimos (por ejemplo una dirección o un alcance incorrectos que nosotros ingresamos); o nuestro incumplimiento de este contrato o de la ley, incluida la privacidad de los datos que tenemos.\n\nCada parte avisa sin demora de una reclamación y coopera de manera razonable. El seguro paga primero cuando corresponda.${COUNSEL}`,
      },
      {
        h: "33. Limitación de responsabilidad",
        p: `Ninguno de nosotros es responsable ante el otro por daños indirectos, especiales o punitivos ni por lucro cesante. Aparte de las excepciones indicadas abajo, la responsabilidad total de cada parte ante la otra según este contrato se limita a la cantidad mayor entre los pagos hechos a usted en los 12 meses anteriores a la reclamación o $5,000. Estos límites no aplican a: los pagos que usted haya ganado; la indemnización por reclamaciones de terceros; lesiones corporales o daños a la propiedad; fraude, negligencia grave o mala conducta intencional; incumplimiento de la confidencialidad o la privacidad; ni a nada que la ley no permita limitar.${COUNSEL}`,
      },
      {
        h: "34. Desactivación y suspensión",
        p: `Dejamos de enviarle ofertas solo por los motivos objetivos de la Política de Desactivación de Profesionales (por ejemplo amenazas a la seguridad, fraude, robo, discriminación, o cancelaciones tardías, inasistencias o problemas de calidad repetidos después de una advertencia por escrito). Le daremos un aviso por escrito con el motivo. Usted puede apelar dentro de ${D.appealDays} días ante una persona, que decidirá dentro de ${D.decisionDays} días.\n\nSuspendemos de inmediato, antes de una apelación, solo por una amenaza creíble a la seguridad, sospecha de fraude o documentos legalmente requeridos vencidos (los documentos vencidos solo pausan las ofertas hasta que usted los renueve). El dinero que usted ha ganado siempre se paga, menos solo los montos debidamente adeudados según las secciones 17 y 18.`,
      },
      {
        h: "35. Vigencia y terminación del contrato",
        p: `Este contrato comienza cuando usted lo firma y continúa hasta que cualquiera de los dos le ponga fin. Usted puede terminarlo en cualquier momento cerrando su cuenta o avisándonos por escrito. Nosotros podemos terminarlo con 14 días de aviso por escrito, o de inmediato según la Política de Desactivación. Los trabajos que usted ya aceptó deben terminarse o cancelarse según la sección 6. Los pagos adeudados por trabajo completado se pagan según el calendario normal. Las secciones que por su naturaleza continúan (confidencialidad, no captación, indemnización, límites de responsabilidad, disputas y pago de montos adeudados) siguen vigentes.`,
      },
      {
        h: "36. Cambios a este contrato",
        p: `Le daremos al menos 30 días de aviso en el portal de profesionales (y por correo electrónico) antes de que un cambio entre en vigor. Los cambios importantes requieren que usted vuelva a firmar antes de recibir nuevas ofertas; en su lugar, usted puede rechazarlos y terminar el contrato, y las condiciones anteriores aplican a todo trabajo que usted haya aceptado antes del cambio. Los montos de los beneficios y las reglas de elegibilidad pueden cambiar según la sección 14. Nunca cambiamos el pago por trabajo que usted ya aceptó.`,
      },
      {
        h: "37. Resolución de desacuerdos: primero hablar, luego arbitraje",
        p: `Hable primero con nosotros. La mayoría de los problemas se resuelven escribiéndonos a ${BRAND.supportEmail}. Si eso no funciona, envíe un aviso por escrito que describa la disputa y lo que usted quiere; nosotros haremos lo mismo. Ambos intentaremos de buena fe resolverla dentro de 30 días.\n\nArbitraje. Si no se resuelve, cualquier disputa entre usted y ${N} que surja de este contrato, de sus trabajos o de su relación con nosotros — incluidas las disputas sobre el pago y sobre si usted es un contratista independiente — será decidida por un árbitro neutral en un arbitraje individual, no por un juez ni un jurado, según las reglas de la American Arbitration Association (AAA) (las reglas Comerciales o las de Empleo, según lo elija el abogado) vigentes cuando se presente la reclamación.${COUNSEL} La Ley Federal de Arbitraje (Federal Arbitration Act) rige esta sección; cuando no aplique (por ejemplo, a los trabajadores del transporte que participan en el comercio interestatal), aplica la Ley Uniforme de Arbitraje de Michigan (Michigan Uniform Arbitration Act).${COUNSEL} El árbitro puede otorgar cualquier remedio individual que podría otorgar un tribunal. Las audiencias se realizan en el condado donde usted vive o por video.\n\nCostos. Usted no pagará en cuotas de presentación más de lo que pagaría para presentar la demanda en un tribunal; nosotros pagaremos todas las demás cuotas del arbitraje y del árbitro. Cada parte paga a sus propios abogados, salvo que la ley o el árbitro otorguen el pago de honorarios.\n\nNo cubierto por el arbitraje:\n• reclamaciones individuales en un tribunal de reclamos menores;\n• denuncias o quejas ante una agencia del gobierno (como la EEOC, el Departamento de Trabajo de EE. UU. o de Michigan, la NLRB o el IRS);\n• reclamaciones por salarios no pagados, clasificación errónea u otras reclamaciones en las que la ley prohíbe exigir el arbitraje o una renuncia;\n• solicitudes de órdenes judiciales de emergencia para detener una amenaza a la seguridad o el mal uso de información confidencial.`,
      },
      {
        h: "38. Renuncia a acciones colectivas y de clase",
        p: `En la medida en que la ley lo permita, usted y ${N} presentan reclamaciones solo de forma individual, no como demandante ni miembro de una clase en una acción de clase, colectiva o representativa, y un árbitro no puede combinar las reclamaciones de distintos profesionales. Si se determina que esta renuncia no es exigible para una reclamación en particular, esa reclamación va a un tribunal, no a un arbitraje de clase, y queda en pausa hasta que termine el arbitraje individual.${COUNSEL}`,
      },
      {
        h: "39. Excluirse del arbitraje",
        p: `Usted puede excluirse del arbitraje (secciones 37–38) dentro de los 30 días posteriores a la primera vez que firme este contrato, enviando un correo electrónico a ${BRAND.supportEmail} con su nombre y las palabras "Me excluyo del arbitraje". Excluirse no tiene ningún efecto sobre sus ofertas, su pago ni su situación con nosotros. Si se excluye, las disputas van a un tribunal, con el paso informal primero.`,
      },
      {
        h: "40. Ley aplicable, firma electrónica y el contrato completo",
        p: `Este contrato se rige por las leyes de Michigan, excepto cuando aplique la Ley Federal de Arbitraje u otra ley federal, y excepto que, si usted vive y trabaja en otro estado, aplican las protecciones laborales irrenunciables de ese estado. Los tribunales del condado de Wayne, Michigan (o el tribunal federal del Distrito Este de Michigan) conocen de cualquier asunto que vaya a juicio, salvo que usted viva en otro lugar y la ley le permita demandar en su lugar de residencia.\n\nUsted acepta firmar electrónicamente. Su nombre escrito y la casilla marcada en el portal son su firma, y conservamos una copia exacta de lo que usted firmó con la fecha, la hora y la dirección IP. Puede descargarla del portal en cualquier momento.\n\nEste contrato, junto con el Código de Conducta, la Política de Desactivación, el Aviso de Verificación de Antecedentes, el Consentimiento de Ubicación y Comunicaciones, sus anexos de oficio y cada orden de trabajo, es el contrato completo entre nosotros y reemplaza las versiones anteriores. Si alguna parte no es exigible, el resto sigue aplicando. No hacer cumplir una condición en una ocasión no constituye una renuncia. Usted no puede transferir este contrato sin nuestro consentimiento; nosotros podemos transferirlo a una empresa que asuma nuestro negocio, avisándole a usted. Los avisos para usted se envían al correo electrónico de su cuenta; los avisos para nosotros se envían a ${BRAND.supportEmail}.`,
      },
    ],
  },
};
