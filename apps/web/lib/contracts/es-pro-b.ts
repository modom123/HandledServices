/*
 * FILE    : apps/web/lib/contracts/es-pro-b.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0048 UTC
 * PURPOSE : Spanish (neutral Latin-American, formal "usted") translations of the pro policies in
 *           pro.ts — Code of Conduct, Deactivation Policy, Background Check Notice, Location &
 *           Communications Consent — and every trade addendum in PRO_ADDENDA, keyed by contract key.
 *           Same section count, order and numbering as the English; numbers come from the same
 *           constants so both languages always match. The English text controls.
 *           TEMPLATES — not legal advice; have counsel review before use.
 * UPDATED : 2026-10-03_1311 UTC — Anexo de Equipo de Trabajo (pro-crew-addendum).
 * UPDATED : 2026-10-05_0418 UTC — Términos de Recompensas (pro-rewards-terms).
 */
import { BRAND, COVERAGES, LICENSED_TRADES, LOCATION_FRESH_MIN, ON_CALL_MAX_HOURS, PRO_POLICY_DEFAULTS, TRADES, money, t } from "@handled/core";
import { DEACTIVATION_RULES } from "./pro";
import type { ContractTranslation } from "./types";

// ─── Shared helpers (mirror pro.ts) ──────────────────────────────────────────────

const COUNSEL = " [Confirmar con un abogado.]";
const P = PRO_POLICY_DEFAULTS;
const L = BRAND.legalName;
const N = BRAND.name;
const D = DEACTIVATION_RULES;
/** Trade label in Spanish (falls back to the English label, then the id). */
const label = (id: string) => t("es", TRADES.find((x) => x.id === id)?.label ?? id);
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const addendum = (title: string, trades: string[], summary: string[], sections: { h: string; p: string }[]): ContractTranslation => ({
  title: `${N} — Anexo para profesionales — ${title}`,
  appliesTo: `Profesionales que realizan trabajos de ${list(trades.map(label))}; complementa el Contrato de Contratista Independiente y prevalece sobre él para estos oficios en caso de conflicto.`,
  summary,
  sections,
});

/** Same list as BUILDING_TRADES in pro.ts. */
const BUILDING = ["plumbing", "electrical", "hvac", "remodel", "painting"];
const BUILDING_TRADES = [...new Set([...LICENSED_TRADES.filter((x) => BUILDING.includes(x)), "remodel", "painting", "low_voltage", "handyman"])];

export const PRO_ES_B: Record<string, ContractTranslation> = {
  // ─── Código de Conducta ─────────────────────────────────────────────────────────
  "pro-code-of-conduct": {
    title: `Código de Conducta para Profesionales de ${N}`,
    appliesTo: `Todo profesional y todo ayudante registrado en cada trabajo de ${N}; forma parte del Contrato de Contratista Independiente.`,
    summary: [
      "Sea respetuoso, honesto y seguro. Tolerancia cero con el acoso, la discriminación, la violencia, el robo y trabajar bajo los efectos de sustancias.",
      "Llegue dentro del horario reservado y mantenga informado al cliente en la aplicación; estos son resultados de servicio al cliente, no reglas sobre cómo hace usted su trabajo.",
      "Fotos solo de las áreas de trabajo. Nunca de personas, documentos u objetos personales, y nunca publicadas sin consentimiento por escrito.",
      "No fume ni use vapeadores dentro ni cerca de la casa del cliente. Tenga cuidado con las mascotas y los portones.",
      "Nunca se quede a solas con un menor a menos que el servicio lo permita; ningún servicio actual lo permite.",
      "Vístase con ropa limpia y apropiada; no se requiere uniforme. Estaciónese de forma legal y respetuosa.",
      "Reporte problemas, incidentes y cualquier situación en la que se haya sentido inseguro. Reportar de buena fe nunca cuenta en su contra.",
    ],
    sections: [
      {
        h: "1. Por qué tenemos un código",
        p: `Los clientes le abren las puertas de sus casas, negocios, vehículos y vidas. Este código establece las normas básicas con las que todo cliente puede contar. Describe resultados y comportamiento, no cómo ejercer su oficio: sus métodos, herramientas y el orden de su trabajo los decide usted. Incumplirlo puede dar lugar a los pasos previstos en la Política de Desactivación.`,
      },
      {
        h: "2. Respeto para todos",
        p: `Trate a los clientes, sus familias, invitados, empleados, vecinos, otros profesionales y a nuestro equipo con cortesía y respeto. Los desacuerdos ocurren: manéjelos con calma y comuníquese con nosotros a través de la aplicación. Nunca discuta con un cliente sobre un reembolso, una calificación o una reseña; avísenos y nosotros nos encargamos.`,
      },
      {
        h: "3. Tolerancia cero",
        p: `Cualquiera de estas conductas da lugar a la suspensión inmediata y a una revisión conforme a la Política de Desactivación:\n• acoso de cualquier tipo, incluidos comentarios, insinuaciones o contacto sexual no deseado, y contactar a un cliente por motivos personales;\n• discriminación o negarse a prestar el servicio por motivos de raza, color, religión, origen nacional, sexo, orientación sexual, identidad de género, edad, discapacidad, estado civil o familiar, estatura, peso o cualquier otra característica protegida (rechazar un trabajo por razones genuinas de seguridad no es discriminación);\n• violencia, amenazas o portar un arma dentro de la casa de un cliente cuando la ley o el cliente lo prohíben;\n• robo, daños intencionales o llevarse cualquier cosa —incluso "basura"— sin la autorización del cliente;\n• trabajar bajo los efectos del alcohol, el cannabis o drogas (incluidos medicamentos recetados que afecten sus capacidades);\n• fraude: fotos falsas, recibos falsos, reportar como terminado un trabajo que no lo está, usar la cuenta de otra persona o pedirle a un cliente que le pague directamente.`,
      },
      {
        h: "4. Llegada y comunicación",
        p: `Los clientes reservan un horario de llegada, y usted eligió aceptarlo. Llegue dentro de ese horario. Si va a llegar tarde, envíe un mensaje al cliente en la aplicación antes de que comience el horario e indique una hora realista. Toque "En camino" al salir para que el cliente reciba una hora estimada de llegada. Avísele al cliente cuando termine. Responda a los mensajes del cliente y de soporte sobre el trabajo en un tiempo razonable mientras el trabajo esté activo. Cómo planifica su día, su ruta y su trabajo depende de usted.`,
      },
      {
        h: "5. Fotos y privacidad",
        p: `• Tome fotos de antes y después solo de las áreas de trabajo.\n• Nunca fotografíe ni grabe a personas, niños, documentos personales, correspondencia, pantallas, medicamentos, objetos de valor ni nada que no tenga relación con el trabajo.\n• Nunca grabe audio ni video de los clientes.\n• No publique en internet nada sobre la casa, el negocio, el vehículo o las mascotas de un cliente sin el consentimiento por escrito del cliente obtenido a través de nosotros.\n• Mantenga en privado lo que vea y escuche.`,
      },
      {
        h: "6. En la casa o el negocio del cliente",
        p: `• No fume, no use vapeadores ni consuma tabaco o cannabis dentro ni cerca de la casa, el negocio, el vehículo o el jardín del cliente.\n• Pida permiso antes de usar el baño, los enchufes, el agua o los aparatos que no formen parte del trabajo, y déjelos como los encontró.\n• Proteja los pisos y los muebles, y limpie su área de trabajo.\n• No lleve invitados, niños ni mascotas a un trabajo.\n• Mantenga la música y las llamadas telefónicas a un volumen que no moleste al cliente ni a los vecinos.`,
      },
      {
        h: "7. Mascotas",
        p: `Pregunte si hay mascotas antes de entrar y mantenga cerradas las puertas y los portones detrás de usted. Nunca deje salir a una mascota. No alimente ni le dé premios a la mascota de un cliente a menos que el trabajo sea de cuidado de mascotas. Si una mascota parece agresiva, no entre: avise al cliente y a nosotros; el trabajo se reprogramará y no contará en su contra.`,
      },
      {
        h: "8. Niños y personas vulnerables",
        p: `Nunca se quede a solas con un menor de 18 años a menos que el servicio lo permita expresamente; actualmente ningún servicio de ${N} lo permite. Si llega y la única persona en casa es un menor, no comience: envíenos un mensaje y espere a un adulto. Sea paciente y respetuoso con los clientes mayores o con discapacidad, y nunca acepte de ellos regalos, préstamos ni dinero (salvo propinas a través de la aplicación o que se ofrezcan libremente).`,
      },
      {
        h: "9. Vestimenta e identificación",
        p: `No hay uniforme ni requisito de ropa de ${N}. Use ropa limpia, apropiada y segura para el trabajo, sin imágenes ni lenguaje ofensivos. Puede usar la marca de su propio negocio. Hay disponible una credencial de identificación opcional de ${N} si desea que los clientes lo reconozcan.`,
      },
      {
        h: "10. Vehículos y estacionamiento",
        p: `Estaciónese de forma legal, no bloquee entradas de vehículos, aceras, hidrantes ni a los vecinos, y no se estacione sobre el césped a menos que el cliente se lo pida. No deje aceite ni residuos. Maneje con cuidado y conforme a la ley en las zonas residenciales.`,
      },
      {
        h: "11. Reportes",
        p: `Reporte a través de la aplicación (o llamando al ${BRAND.supportPhone} si es urgente): cualquier lesión o daño; cualquier situación que lo haya hecho sentir inseguro o incómodo; el acoso o la discriminación de un cliente hacia usted; un ayudante o profesional que incumpla este código; o cualquier cosa que parezca abuso, negligencia o un delito (en una emergencia, llame primero al 911). Puede reportar el acoso de un cliente y negarse a volver con ese cliente. Los reportes hechos de buena fe nunca cuentan en su contra, y no toleramos represalias.`,
      },
    ],
  },

  // ─── Política de Desactivación ──────────────────────────────────────────────────
  "pro-deactivation-policy": {
    title: `Política de Desactivación para Profesionales de ${N}`,
    appliesTo: `Todo profesional; explica las únicas razones por las que ${N} pausa o deja de enviar ofertas de trabajo, y cómo apelar. Forma parte del Contrato de Contratista Independiente.`,
    summary: [
      "Las ofertas de trabajo se detienen solo por las razones objetivas que se indican aquí; nunca por rechazar ofertas ni por trabajar con otras empresas.",
      "La suspensión inmediata se aplica solo por amenazas a la seguridad, violencia, robo, fraude, trabajar bajo los efectos de sustancias o discriminación.",
      "Un seguro, una licencia o un documento requerido vencido solo pausa las ofertas hasta que lo renueve; eso no es una desactivación.",
      `Los problemas de desempeño (calificaciones bajas, cancelaciones tardías, ausencias, fallas repetidas en el control de calidad, solicitar clientes fuera de la plataforma) reciben primero una advertencia por escrito y ${D.improveDays} días para mejorar.`,
      `Siempre recibe un aviso por escrito con el motivo, y puede apelar ante una persona dentro de ${D.appealDays} días. Decidimos dentro de ${D.decisionDays} días.`,
      "El dinero que usted ha ganado siempre se paga.",
    ],
    sections: [
      {
        h: "1. Qué cubre esta política",
        p: `"Desactivación" significa que dejamos de enviarle ofertas de trabajo y terminamos el contrato. "Suspensión" significa que las ofertas se pausan mientras revisamos algo. "Pausa" significa que las ofertas se detienen automáticamente hasta que se renueve un documento. Usamos estas medidas solo por las razones que se indican a continuación. Rechazar o ignorar ofertas, fijar un horario reducido, una distancia de manejo corta o un límite diario bajo, trabajar con otras plataformas, con competidores o con sus propios clientes, y presentar una queja o un reporte de seguridad de buena fe nunca son motivos de desactivación.`,
      },
      {
        h: "2. Pausa automática: documentos vencidos",
        p: `Las ofertas se pausan automáticamente, el mismo día en que ocurre, si cualquiera de estos está vencido o falta: el seguro de responsabilidad civil general, una cobertura que su oficio requiere (auto, fianza, transporte de pasajeros, alcohol, compensación laboral), una licencia o certificación requerida (por ejemplo, la capacitación en HIPAA para entregas médicas) o su verificación de antecedentes. Esto no es una desactivación y no requiere apelación. Le avisamos 30 días antes del vencimiento. Suba la renovación y las ofertas se reanudan en cuanto se verifique. Los trabajos que ya aceptó y que legalmente ya no puede realizar se reasignarán; se le paga cualquier trabajo ya terminado.`,
      },
      {
        h: "3. Suspensión inmediata y luego revisión",
        p: `Suspendemos las ofertas de inmediato, antes de una apelación, cuando recibimos un reporte creíble de:\n• una amenaza a la seguridad de cualquier persona, o violencia;\n• robo o daño intencional;\n• fraude (fotos, recibos o finalización falsos; compartir la cuenta; cobrar directamente);\n• trabajar bajo los efectos del alcohol o drogas;\n• acoso, incluido el acoso sexual, o discriminación;\n• en entregas médicas, una violación grave de la privacidad (HIPAA); en transporte, una infracción grave de seguridad.\n\nLe informamos por escrito, dentro de un día hábil, qué se reportó (sin identificar a quien lo reportó cuando eso lo pondría en riesgo), y usted puede dar su versión. Una persona de nuestro equipo revisa las pruebas —el registro del trabajo, las fotos, los mensajes y las declaraciones— y decide dentro de ${D.decisionDays} días si lo reincorpora o lo desactiva. Si se le exonera, las ofertas se reanudan de inmediato y la suspensión no cuenta en su contra.`,
      },
      {
        h: "4. Después de una advertencia por escrito",
        p: `Las siguientes situaciones dan lugar primero a una advertencia por escrito, con los hechos y lo que debe cambiar. Si el problema continúa ${D.improveDays} días después de la advertencia, una persona de nuestro equipo lo revisa y puede desactivarlo:\n• una calificación promedio de los clientes inferior a ${D.minRating}★ en sus últimos ${D.ratedJobs} trabajos calificados;\n• ${D.lateCancels} o más cancelaciones tardías (dentro de las ${D.lateCancelHours} horas previas al horario), o ${D.noShows} o más ausencias, en ${D.windowDays} días;\n• ${D.qaFailures} o más trabajos en ${D.windowDays} días que no pasaron la revisión de fotos y no se corrigieron;\n• solicitar clientes fuera de la plataforma (sección 28 del Contrato);\n• incumplimientos repetidos del Código de Conducta que no sean de tolerancia cero.\n\nLas cancelaciones tardías y ausencias causadas por una emergencia, enfermedad, condiciones inseguras, mal tiempo severo o el cliente no cuentan cuando nos avisa. Se eliminan las calificaciones que usted demuestre que fueron represalias o discriminatorias. Publicamos estos límites en su portal y damos un aviso de 30 días antes de cambiarlos.${COUNSEL}`,
      },
      {
        h: "5. Aviso",
        p: `Toda suspensión y desactivación viene con un aviso por escrito (en el portal y por correo electrónico) que indica el motivo, los hechos en los que nos basamos y cómo apelar. Nunca lo desactivamos sin decirle por qué.`,
      },
      {
        h: "6. Apelación ante una persona",
        p: `Puede apelar dentro de los ${D.appealDays} días siguientes al aviso, en el portal o por correo electrónico a ${BRAND.supportEmail}. Envíe todo lo que quiera que se considere: fotos, mensajes, recibos, nombres de testigos, su explicación. Una persona que no participó en la decisión original la revisa —nunca solo un sistema automatizado— y decide dentro de los ${D.decisionDays} días siguientes a recibir su apelación, por escrito y con sus razones. Si revoca la decisión, las ofertas se reanudan de inmediato y el registro se borra. La apelación no afecta su derecho a usar el proceso de resolución de disputas del Contrato.`,
      },
      {
        h: "7. Cómo volver",
        p: `• Documentos vencidos: suba la renovación; las ofertas se reanudan una vez verificada.\n• Desactivación por desempeño: puede volver a solicitar después de 6 meses. Díganos qué cambió; comenzará de nuevo con trabajos de período de prueba.\n• Verificación de antecedentes: si un informe era incorrecto y se corrige, lo reincorporamos.\n• Las desactivaciones por tolerancia cero son permanentes, a menos que el motivo resulte ser falso.`,
      },
      {
        h: "8. Su dinero siempre se paga",
        p: `La desactivación o la suspensión nunca cancelan el dinero que usted ha ganado: los pagos de trabajos terminados, el pago por presentarse, los reembolsos de materiales, las propinas, los estipendios y los bonos se pagan en el calendario normal. Las únicas deducciones son los reembolsos por mano de obra y los contracargos tramitados conforme al Contrato, con aviso y oportunidad de responder. Un pago vinculado a un reporte creíble de fraude puede retenerse solo para ese trabajo mientras se revisa.`,
      },
    ],
  },

  // ─── Aviso de Verificación de Antecedentes ─────────────────────────────────────
  "pro-background-check": {
    title: `Aviso de Verificación de Antecedentes de ${N}`,
    appliesTo: `Todo profesional y ayudante registrado antes de la activación y en cada nueva verificación. Explica el proceso; la divulgación y autorización independientes exigidas por la ley las entrega por separado nuestro proveedor de verificación.`,
    summary: [
      "Este aviso explica nuestras verificaciones de antecedentes en lenguaje sencillo. NO es la divulgación ni la autorización legal: ese es un formulario independiente que nuestro proveedor de verificación (Checkr) le entrega antes de cualquier verificación.",
      "Revisamos antecedentes penales y registros de delincuentes sexuales y, para los oficios que implican manejar, su historial de manejo. Repetimos la verificación cada año.",
      "Puede obtener una copia gratuita de su informe y disputar cualquier dato incorrecto.",
      "Antes de cualquier decisión basada en un informe, usted recibe una copia, un resumen de sus derechos y al menos 5 días hábiles para responder.",
      "Analizamos cada antecedente de forma individual: qué fue, hace cuánto tiempo y si tiene relación con el trabajo.",
    ],
    sections: [
      {
        h: "1. Este no es el aviso de divulgación de la FCRA",
        p: `Según la Ley federal de Informes de Crédito Justos (Fair Credit Reporting Act, FCRA), debemos entregarle una divulgación clara e independiente y obtener su autorización por escrito antes de solicitar un informe de antecedentes. Nuestro proveedor de verificación, Checkr, le entrega ese formulario independiente (por correo electrónico, antes de la verificación). Este aviso es información adicional para ayudarle a entender el proceso. No reemplaza ese formulario, y firmar este aviso no constituye su autorización.`,
      },
      {
        h: "2. Qué revisamos",
        p: `Con su autorización, el informe puede incluir:\n• antecedentes penales (base de datos nacional y búsquedas en los condados y tribunales federales donde ha vivido);\n• registros nacionales y estatales de delincuentes sexuales;\n• verificación de identidad y del número de Seguro Social;\n• para los oficios que implican manejar para los trabajos (por ejemplo, transporte, mandados, entregas médicas, acarreo): su historial de manejo y el estado de su licencia.\nNo revisamos su historial de crédito. Cada ayudante registrado que entre a las casas de los clientes pasa por la misma verificación.`,
      },
      {
        h: "3. Nuevas verificaciones",
        p: `Hacemos una nueva verificación cada año, cuando usted agrega un oficio que implica manejar y si recibimos información creíble de que un antecedente puede haber cambiado. Cada nueva verificación usa el mismo proceso de divulgación y autorización independientes (su autorización original puede cubrir las nuevas verificaciones cuando la ley lo permite; el formulario lo indicará).`,
      },
      {
        h: "4. Cómo decidimos",
        p: `Un antecedente no lo descalifica automáticamente. Analizamos cada uno de forma individual: la naturaleza y gravedad del delito, hace cuánto tiempo ocurrió, si tiene relación con el trabajo y con los clientes a quienes atendería (por ejemplo, entrar a casas, transportar pasajeros, manejar medicamentos) y cualquier prueba de rehabilitación que nos presente. No consideramos arrestos que no terminaron en condena cuando la ley de Michigan lo prohíbe, antecedentes eliminados o anulados, ni antecedentes juveniles.${COUNSEL}`,
      },
      {
        h: "5. Antes de cualquier decisión: aviso previo a una acción adversa",
        p: `Si algo en el informe pudiera llevarnos a no activarlo o a dejar de enviarle ofertas, primero le enviamos un aviso previo a una acción adversa con una copia del informe, el "Resumen de sus derechos según la FCRA" de la CFPB y el antecedente que nos preocupa. Luego tiene al menos 5 días hábiles para decirnos si el informe es incorrecto, para disputarlo con Checkr o para darnos contexto (como su rehabilitación, o que el antecedente no es suyo). Si usted ha iniciado una disputa, esperaremos a que se resuelva antes de decidir.`,
      },
      {
        h: "6. Si decidimos no continuar: aviso de acción adversa",
        p: `Si decidimos no activarlo o dejar de enviarle ofertas basándonos total o parcialmente en el informe, le enviamos un aviso de acción adversa que indica: el nombre, la dirección y el número de teléfono de la empresa de verificación; que la empresa de verificación no tomó la decisión y no puede explicar por qué se tomó; su derecho a una copia gratuita de su informe si la solicita dentro de 60 días; y su derecho a disputar ante la empresa de verificación la exactitud o integridad de cualquier dato del informe.`,
      },
      {
        h: "7. Cómo obtener una copia y presentar una disputa",
        p: `Puede pedir a Checkr una copia de su informe en cualquier momento (gratuita después de un aviso de acción adversa) y disputar cualquier dato inexacto o incompleto directamente con Checkr, que debe volver a investigar, normalmente dentro de 30 días. Si un informe corregido lo exonera, lo reconsideraremos de inmediato.`,
      },
      {
        h: "8. Michigan y las normas de oportunidad justa",
        p: `Michigan no tiene una ley estatal de "ban-the-box" (que prohíbe preguntar por antecedentes penales en la solicitud) para empresas privadas, pero algunas ciudades (entre ellas Detroit, para los contratistas de la ciudad) tienen normas de oportunidad justa, y otros estados y ciudades a los que podríamos expandirnos tienen las suyas; algunas limitan cuándo y cómo se pueden considerar los antecedentes o exigen una evaluación individualizada. Seguimos la norma más estricta dondequiera que usted trabaje, y nuestra solicitud no pregunta por antecedentes penales antes de una oferta condicional de activación.${COUNSEL}`,
      },
      {
        h: "9. Privacidad",
        p: `Los informes de antecedentes solo los ven las personas de nuestro equipo que toman las decisiones de activación, se guardan de forma segura, se usan solo para determinar la elegibilidad y se conservan solo durante el tiempo que exige la ley.`,
      },
    ],
  },

  // ─── Consentimiento de Ubicación y Comunicaciones ──────────────────────────────
  "pro-location-and-communications": {
    title: `Consentimiento de Ubicación y Comunicaciones de ${N}`,
    appliesTo: `Todo profesional que use la aplicación o el portal para profesionales de ${N}; explica cuándo usamos su ubicación y cómo nos comunicamos con usted, y registra su consentimiento.`,
    summary: [
      "Usamos la ubicación de su teléfono solo mientras usted está De guardia o tiene un trabajo ese día; nunca en sus días libres ni cuando no está de guardia y no tiene trabajo.",
      `Los clientes ven solo una posición aproximada, y solo mientras usted va en camino a su trabajo o está en él. Las ubicaciones guardadas se borran después de 12 horas.`,
      "Le enviamos mensajes de texto, notificaciones push y correos electrónicos sobre ofertas de trabajo y trabajos. Responda STOP para dejar de recibir mensajes de texto en cualquier momento; las ofertas seguirán apareciendo en la aplicación.",
      "Los mensajes de marketing son aparte y opcionales.",
      "Actualmente no grabamos llamadas. Si alguna vez empezamos, se lo diremos primero.",
    ],
    sections: [
      {
        h: "1. Cuándo usamos su ubicación",
        p: `Con su permiso en la configuración de su teléfono, la aplicación comparte su ubicación solo:\n• mientras usted tenga activado "De guardia" (usted elige por cuánto tiempo, hasta ${ON_CALL_MAX_HOURS} horas, y puede desactivarlo en cualquier momento); o\n• un día en que tenga un trabajo de ${N}, para que podamos mostrarle al cliente una hora estimada de llegada.\nNo recopilamos su ubicación en sus días libres, ni cuando no está de guardia y no tiene trabajo ese día. Si desactiva la ubicación en su teléfono, la aplicación sigue funcionando; simplemente no recibirá ofertas para el mismo día "cerca de usted" ni horas estimadas de llegada en vivo.`,
      },
      {
        h: "2. Para qué la usamos",
        p: `• Ofrecer trabajos para el mismo día cerca de donde usted se encuentra (para los profesionales que están De guardia).\n• Informar a su cliente, mientras usted va en camino a su trabajo o está en él, aproximadamente a qué distancia está y cuándo llegará. Los clientes ven una posición aproximada (redondeada a unos 100 metros) y solo para su propio trabajo, ese día.\n• Que nuestro equipo de soporte vea quién está de guardia o en un trabajo, para ayudar con emergencias, cerraduras bloqueadas y reasignaciones.\nNunca vendemos su ubicación, ni la usamos para vigilar cómo trabaja, ni la compartimos con nadie más, salvo cuando la ley lo exige o en una emergencia que afecte su seguridad.`,
      },
      {
        h: "3. Cuánto tiempo la conservamos",
        p: `Una ubicación con más de ${LOCATION_FRESH_MIN} minutos de antigüedad no se usa ni se muestra como ubicación en vivo. Toda ubicación guardada se borra después de 12 horas, y se borra de inmediato cuando usted sale de guardia sin tener trabajo ese día. Los registros de trabajo conservan solo las horas de llegada y de finalización, no su ruta.`,
      },
      {
        h: "4. Mensajes de texto, notificaciones push y correo electrónico",
        p: `Al darnos su número de celular y activar las notificaciones, usted acepta que ${N} le envíe mensajes de texto automatizados, notificaciones push y correos electrónicos sobre: ofertas de trabajo; actualizaciones, recordatorios y mensajes de clientes sobre los trabajos; pagos y estados de cuenta; documentos por vencer; avisos de cuenta y de seguridad; y este contrato. La frecuencia de los mensajes varía según sus ofertas y trabajos. Pueden aplicarse tarifas de mensajes y datos. El consentimiento no es una condición para trabajar con nosotros: puede ver las ofertas en la aplicación.\n\nResponda STOP a cualquier mensaje de texto para dejar de recibirlos, y HELP para obtener ayuda. Puede desactivar las notificaciones push en su teléfono y cambiar la configuración del correo electrónico en el portal. Los avisos de cuenta y legales seguirán llegando por correo electrónico.\n\nEl marketing (consejos, promociones, eventos de reclutamiento) es aparte: solo se lo enviamos si usted lo acepta, y puede darse de baja en cualquier momento sin que afecte sus ofertas.`,
      },
      {
        h: "5. Llamadas y mensajes en la aplicación",
        p: `Actualmente no grabamos llamadas telefónicas. Si empezamos a hacerlo, se lo diremos primero y lo anunciaremos al inicio de cada llamada grabada. Los mensajes en la aplicación entre usted, los clientes y nuestro equipo se guardan con el registro del trabajo y pueden revisarse por motivos de seguridad, calidad, soporte y disputas. No está obligado a compartir su número de teléfono personal con los clientes.`,
      },
      {
        h: "6. Si cambia de opinión",
        p: `Puede retirar su consentimiento de ubicación en la configuración de su teléfono, dejar de recibir mensajes de texto con STOP y desactivar las notificaciones push o el marketing en cualquier momento. Retirar su consentimiento nunca cuenta en su contra; solo desactiva las funciones que lo necesitan.`,
      },
    ],
  },

  // ─── Anexos por oficio ──────────────────────────────────────────────────────────

  "pro-addendum-transportation": addendum("Transporte de Pasajeros", ["transportation"], [
    "Solo empresas transportistas con licencia: autorización del MDOT para viajes dentro de Michigan; número USDOT y autorización de la FMCSA para viajes interestatales o cuando apliquen las normas federales.",
    `${N} organiza los viajes como agente del cliente. Usted es el transportista y es totalmente responsable de operar el vehículo y el viaje.`,
    "Seguro de transporte de pasajeros, vehículos inspeccionados y conductores calificados (clase de licencia correcta, historial limpio, pruebas de drogas y alcohol y límites de horas de servicio cuando apliquen).",
    "Nadie menor de 21 años bebe alcohol. Los conductores nunca beben. Se aceptan la accesibilidad y los animales de servicio; asientos infantiles según la ley de Michigan.",
    "Reporte cualquier accidente o lesión de inmediato, y a nosotros dentro de 24 horas.",
  ], [
    {
      h: "1. Quién es usted y quiénes somos nosotros",
      p: `Los trabajos de transporte se asignan solo a empresas de transporte de pasajeros con licencia, nunca a conductores individuales en autos personales. Usted, el transportista, proporciona el vehículo y el conductor y es el único responsable de operar el viaje de forma segura y legal. ${N} reserva el viaje y cobra el pago como agente del cliente; no somos un transportista, no operamos vehículos y no controlamos a sus conductores ni sus vehículos.${COUNSEL}`,
    },
    {
      h: "2. Autorización de operación",
      p: `Usted tendrá y mantendrá vigentes: la autorización del MDOT como transportista de pasajeros por contrato / limusinas de Michigan para los viajes dentro del estado; y un número USDOT y la autorización de operación de la FMCSA para los viajes interestatales y en cualquier otro caso en que las normas federales lo exijan (por ejemplo, vehículos diseñados para 16 o más personas, incluido el conductor). Cumplirá las normas de permisos de aeropuertos, lugares de eventos o ciudades para recoger pasajeros y esperar. Avísenos de inmediato si se suspende o revoca cualquier autorización; las ofertas se detienen hasta que se restablezca.`,
    },
    {
      h: "3. Vehículos y seguros",
      p: `• Todo vehículo que se use debe estar registrado en su cuenta con número de asientos, año e inspección vigente, matriculado y en condiciones seguras de funcionamiento, e inspeccionado según lo exija el MDOT (y la FMCSA, cuando aplique).\n• Usted tendrá un seguro de ${lcFirst(t("es", COVERAGES.passenger_auto.label))}: ${t("es", COVERAGES.passenger_auto.detail)} Estos son nuestros mínimos; si la ley o un lugar de eventos o cliente corporativo exige más, se aplica el monto mayor.${COUNSEL}\n• Cobertura sin culpa (no-fault, PIP) de Michigan según se exija para sus vehículos, y compensación laboral para los conductores que sean sus empleados.\n• Incluya a ${L} como asegurado adicional cuando su aseguradora lo permita.`,
    },
    {
      h: "4. Conductores",
      p: `Todo conductor debe estar registrado en su cuenta y debe: tener la clase de licencia y los endosos correctos para el vehículo (una licencia de conducir comercial, CDL, con endoso de pasajeros para vehículos diseñados para 16 o más personas); tener un historial de manejo limpio que cumpla el estándar de su aseguradora y el nuestro; aprobar nuestra verificación de antecedentes; estar inscrito en las pruebas de drogas y alcohol del DOT cuando se requiera (conductores con CDL); y cumplir los límites federales de horas de servicio cuando apliquen (para vehículos que transportan pasajeros: no más de 10 horas de manejo después de 8 horas consecutivas fuera de servicio, no manejar después de 15 horas en servicio, y los límites semanales de 60/70 horas). Los conductores nunca consumen alcohol ni drogas dentro de los plazos prohibidos por la ley y nunca manejan bajo sus efectos ni cansados. No se permite usar el teléfono en la mano mientras se maneja.`,
    },
    {
      h: "5. Pasajeros, alcohol y conducta",
      p: `• Los conductores nunca beben alcohol mientras están en servicio.\n• Cuando la ley de Michigan permite alcohol en el área de pasajeros de una limusina o autobús contratado, solo pueden beber los pasajeros de 21 años o más. Si hay a bordo alguien menor de 21 años, siga el acuerdo del cliente y la ley: nada de alcohol para nadie menor de 21 años, y usted puede terminar el servicio si ocurre.${COUNSEL}\n• Puede rechazar o terminar un viaje (de forma segura, en un lugar público e iluminado) por violencia, amenazas, actividad ilegal o conductas que hagan inseguro el manejo; repórtelo a nosotros de inmediato.\n• No exceda la capacidad de asientos. Todos usan cinturón de seguridad cuando lo haya.`,
    },
    {
      h: "6. Accesibilidad y niños",
      p: `No rechace a un pasajero por una discapacidad o un animal de servicio. Cuando una reserva solicite un vehículo accesible para sillas de ruedas, proporcione uno que cumpla las normas de la ADA o avísenos de inmediato si no puede. Los niños deben viajar en los asientos infantiles o elevadores que exige la ley de Michigan; el cliente los proporciona, a menos que la reserva indique que usted lo hará.`,
    },
    {
      h: "7. Accidentes e incidentes",
      p: `Después de cualquier accidente: asegúrese de que todos estén a salvo, llame al 911 si alguien está herido, intercambie información y cumpla las normas de reporte de su aseguradora y de la ley (incluidas las normas del registro de accidentes de la FMCSA cuando apliquen). Avísenos de inmediato si hay pasajeros afectados, y por escrito dentro de 24 horas en todos los casos.`,
    },
  ]),

  "pro-addendum-medical-courier": addendum("Mensajería Médica y HIPAA", ["medical_courier"], [
    `En las entregas médicas, usted es un socio comercial subcontratista según la HIPAA: use solo la información mínima necesaria del paciente, manténgala segura y reporte cualquier problema dentro de 24 horas.`,
    "Mantenga los paquetes sellados, bajo llave y con usted. Nunca deje uno sin vigilancia ni en una puerta, a menos que las instrucciones del remitente lo indiquen.",
    "No tome fotos de las etiquetas, salvo la prueba que exige la aplicación. Sin desvíos ni pasajeros en las entregas médicas.",
    "Se requiere capacitación vigente en HIPAA (y capacitación en patógenos transmitidos por la sangre para muestras). El remitente empaca las muestras (UN3373 Categoría B); usted las mantiene en posición vertical, a la temperatura correcta y con un kit para derrames.",
    "Cadena de custodia: escanee o firme en cada entrega y recepción, y verifique la identificación cuando se requiera.",
  ], [
    {
      h: "1. HIPAA: usted es un socio comercial subcontratista",
      p: `Cuando transporta recetas, muestras, expedientes u otros artículos para clínicas, farmacias o laboratorios, puede ver información médica protegida (PHI): nombres, direcciones, números de teléfono y etiquetas. ${N} firma acuerdos de socio comercial con estos clientes, y usted acepta las mismas restricciones como socio comercial subcontratista conforme a 45 C.F.R. § 164.502(e) y § 164.504(e). Este anexo es su acuerdo escrito de subcontratista para ese fin.${COUNSEL}`,
    },
    {
      h: "2. Mínimo necesario",
      p: `Use y mire solo la información que necesita para recoger y entregar: por lo general, el nombre, la dirección y el teléfono del destinatario y las etiquetas de los paquetes sellados. Nunca abra un paquete sellado, lea los documentos que contiene ni hable sobre un paciente, una entrega o lo que transportó con nadie, salvo con el remitente, el destinatario y nuestro equipo.`,
    },
    {
      h: "3. Medidas de protección",
      p: `• Mantenga los paquetes sellados y bajo su control en todo momento; guárdelos bajo llave en su vehículo (en un compartimiento o contenedor con llave cuando sea posible) siempre que se aleje.\n• Nunca deje un paquete sin vigilancia, con un vecino ni en una puerta, a menos que las instrucciones escritas del remitente lo permitan.\n• No tome fotos de las etiquetas ni del contenido, salvo la foto o el escaneo de prueba de entrega que exige la aplicación, encuadrado para mostrar la menor cantidad posible de información del paciente.\n• Mantenga su teléfono bloqueado con una contraseña; no guarde datos de pacientes fuera de la aplicación.\n• Sin desvíos, paradas personales ni pasajeros durante una entrega médica: vaya directamente del lugar de recogida al de entrega.`,
    },
    {
      h: "4. Reporte de violaciones e incidentes",
      p: `Repórtenos dentro de las 24 horas siguientes a descubrirlo (de inmediato si puede) cualquier pérdida, robo, entrega equivocada, paquete abierto o dañado, entrega a un destinatario incorrecto, o cualquier uso o divulgación de PHI que no esté permitido aquí. Coopere con nuestra investigación y con las obligaciones del cliente de notificar violaciones, y no se comunique usted mismo con el paciente sobre el incidente a menos que se lo pidamos.`,
    },
    {
      h: "5. Capacitación y certificados",
      p: `Mantenga en su expediente un certificado vigente de capacitación en HIPAA (forma parte de la incorporación; las ofertas se detienen cuando vence). Para las muestras de laboratorio también necesita capacitación vigente de OSHA en patógenos transmitidos por la sangre. Se recomienda enfáticamente la capacitación de concientización sobre materiales peligrosos del DOT para muestras UN3373. La capacitación se exige porque la ley lo exige, no para controlar cómo trabaja usted.`,
    },
    {
      h: "6. Muestras y artículos sensibles a la temperatura",
      p: `• El remitente empaca las muestras como UN3373 Sustancia Biológica, Categoría B (triple embalaje, material absorbente, etiquetado). No acepte un paquete que tenga fugas, esté dañado o no esté bien etiquetado: avise al remitente y a nosotros.\n• Mantenga las muestras en posición vertical, aseguradas, lejos del espacio de los pasajeros y dentro del rango de temperatura indicado en el paquete o la orden de trabajo, usando una hielera o contenedor validado cuando se requiera.\n• Lleve un kit para derrames y guantes. Si un paquete tiene fugas, siga su capacitación en patógenos transmitidos por la sangre, no limpie sin protección y repórtelo de inmediato.`,
    },
    {
      h: "7. Cadena de custodia y entrega",
      p: `Escanee o firme en la aplicación, con la hora, en cada recogida y entrega. Entregue solo al destinatario indicado o a una persona autorizada en el establecimiento, y verifique la identificación con foto (y obtenga una firma) cuando la orden de trabajo lo exija; siempre en el caso de sustancias controladas. Si no puede entregar, siga las instrucciones del remitente o devuelva el paquete al remitente el mismo día; nunca lo guarde durante la noche a menos que las instrucciones escritas del remitente lo permitan.`,
    },
    {
      h: "8. Sustancias controladas",
      p: `Las recetas que incluyan sustancias controladas deben entregarse solo al paciente o a su adulto autorizado (18 años o más) después de verificar su identificación y obtener su firma; nunca se dejan en una puerta. Nunca las abra, las cuente ni las retenga más tiempo del que requiere la entrega. Reporte cualquier pérdida o robo a nosotros y a la farmacia de inmediato para que la farmacia pueda presentar los reportes que exige la DEA. Siga cualquier norma adicional de la farmacia que aparezca en la orden de trabajo.${COUNSEL}`,
    },
    {
      h: "9. Devolución o destrucción de PHI",
      p: `Cuando termine una entrega, o cuando termine este contrato, devuelva al remitente cualquier documento con información de pacientes o destrúyalo de forma segura (triturándolo), y borre de sus dispositivos cualquier dato de pacientes. Si no puede hacerlo, siga protegiéndolo conforme a este anexo durante todo el tiempo que lo tenga.`,
    },
  ]),

  "pro-addendum-licensed-trades": addendum("Oficios con Licencia y Mejoras del Hogar", BUILDING_TRADES, [
    "El trabajo que requiere licencia (plomería, electricidad, HVAC, y remodelación y pintura residencial por encima del umbral de Michigan) necesita una licencia vigente a nombre de su negocio. Los profesionales de mantenimiento general y de bajo voltaje nunca hacen trabajos que requieran una licencia que no tienen.",
    "La parte con licencia tramita los permisos; el costo de los permisos va en la factura del cliente mediante una orden de cambio. El trabajo cumple el código y pasa las inspecciones.",
    "Certificación de trabajo seguro con plomo de la EPA (EPA RRP) para pintura o remodelación que altere la pintura en casas construidas antes de 1978.",
    "El trabajo con licencia y de remodelación tiene una garantía de mano de obra de 1 año (reparaciones sin pago adicional, a menos que otra persona haya causado el problema).",
    "Una vez que le pagamos, usted renuncia a sus derechos de gravamen por ese trabajo, y les paga a sus proveedores y ayudantes para que los clientes nunca enfrenten un gravamen.",
    "Limpie todos los días; corte y restablezca los servicios públicos de forma segura.",
  ], [
    {
      h: "1. Licencias",
      p: `El trabajo para el que Michigan exige licencia se asigna solo a profesionales con la licencia correspondiente: licencias de contratista de plomería, electricidad y mecánica (HVAC) emitidas por LARA, con el trabajo realizado por un maestro u oficial con licencia; una licencia de Constructor Residencial (Residential Builder) o de Contratista de Mantenimiento y Alteraciones (Maintenance & Alteration Contractor) para trabajos de remodelación y pintura residencial por encima del umbral estatal (actualmente $600); y la certificación de la Sección 608 de la EPA para trabajos con refrigerantes. La licencia debe estar vigente y a nombre de su negocio (o de su representante calificado) según lo exija la ley. Los profesionales de mantenimiento general y de bajo voltaje no hacen trabajos de plomería, electricidad (de voltaje de línea), HVAC ni otros trabajos que requieran licencia: deténgase y avísenos si resulta que un trabajo lo requiere.`,
    },
    {
      h: "2. Permisos e inspecciones",
      p: `Cuando un trabajo requiere un permiso, la parte con licencia lo tramita antes de comenzar el trabajo, lo exhibe según se requiera y programa las inspecciones. Las tarifas de los permisos se trasladan al cliente en la factura mediante una orden de cambio (si no están ya incluidas en el precio). El trabajo debe cumplir los códigos aplicables y pasar la inspección; corregir una inspección reprobada por causa de su trabajo no genera pago adicional.`,
    },
    {
      h: "3. Trabajo seguro con plomo (RRP)",
      p: `Para trabajos de pintura, remodelación o reparación que alteren superficies pintadas en casas o instalaciones ocupadas por niños construidas antes de 1978, la empresa debe tener la certificación EPA RRP, un renovador certificado debe dirigir el trabajo, y se exigen prácticas de trabajo seguro con plomo, el folleto "Renovate Right" de la EPA y el mantenimiento de registros.`,
    },
    {
      h: "4. Garantía de mano de obra",
      p: `El trabajo de oficios con licencia y de remodelación tiene una garantía de mano de obra de 1 año a partir de su terminación (los demás trabajos de estos oficios tienen la repetición estándar de ${BRAND.guaranteeDays} días). Durante la garantía, usted reparará los defectos de su mano de obra sin pago adicional. Los problemas causados por otros —el cliente, otro contratista, el mal uso, el desgaste normal o defectos de fábrica en productos que usted no eligió— no están cubiertos, y su reparación es un nuevo trabajo pagado. Las garantías del fabricante de los productos pasan al cliente; regístrelas cuando sea necesario.${COUNSEL}`,
    },
    {
      h: "5. Gravámenes y pago a sus proveedores",
      p: `${N} cobra al cliente y le paga a usted. Una vez que se le haya pagado un trabajo (o una etapa), usted renuncia y libera cualquier derecho de gravamen de construcción sobre la propiedad del cliente por ese trabajo, y firmará una renuncia de gravamen por escrito en la forma que exige la Ley de Gravámenes de Construcción de Michigan (Construction Lien Act) si nosotros o el cliente se lo pedimos. Pagará a sus proveedores, subcontratistas y ayudantes en su totalidad y a tiempo para que nadie presente un gravamen contra un cliente. Si se presenta un gravamen porque usted no le pagó a alguien, usted lo hará levantar a su costo, y nosotros podemos usar los pagos que se le deban para pagarle directamente a esa persona.${COUNSEL}`,
    },
    {
      h: "6. Materiales",
      p: `Los materiales no incluidos en el precio se compran y reembolsan mediante el proceso aprobado de la aplicación (subir el recibo; nuestra aprobación por encima del límite de aprobación automática; una orden de cambio para montos grandes). Use materiales que cumplan el código y el alcance del trabajo. No sustituya un producto que el cliente eligió por otro distinto sin su aprobación a través de la aplicación.`,
    },
    {
      h: "7. Cuidado del lugar, limpieza y servicios públicos",
      p: `Proteja los pisos, los muebles y los acabados; contenga el polvo; limpie al final de cada día y retire sus escombros (a menos que el alcance indique otra cosa). Antes de cortar el agua, el gas o la electricidad, avise al cliente; restablezca el servicio de forma segura cuando termine o explique en la aplicación por qué no puede. Nunca deje un peligro sin vigilancia (cables expuestos, gas cortado sin aviso, zanjas abiertas, escaleras sin asegurar).`,
    },
  ]),

  "pro-addendum-pet-care": addendum("Cuidado de Mascotas y Desechos de Mascotas", ["pet_care", "pet_waste"], [
    "Las mascotas van con correa fuera de un área cercada, siempre. Nunca sin correa en parques ni en paseos.",
    "Confirmamos con el dueño las vacunas de la mascota; usted puede rechazar cualquier mascota que no las tenga al día.",
    "Siempre puede negarse o detenerse ante un animal agresivo. Nunca cuenta en su contra.",
    "¿Una emergencia? Ponga a la mascota a salvo y llame al dueño y a nosotros. Podemos autorizar atención veterinaria cuando el dueño lo haya aceptado por adelantado.",
    "Respete los límites por clima, asegure los portones y mantenga seguros las llaves y los códigos de las cajas de seguridad.",
  ], [
    {
      h: "1. Correas y portones",
      p: `Los perros van con una correa segura en todo momento fuera de un área totalmente cercada; nunca sin correa en paseos, parques o parques para perros, a menos que el dueño haya dado permiso por escrito a través de nosotros y el lugar lo permita. Pasee a los perros de un solo hogar a la vez, a menos que el dueño esté de acuerdo. Revise los portones y las puertas antes de dejar a una mascota en un patio, y ciérrelos cada vez; esto también aplica a las visitas de recolección de desechos de mascotas.`,
    },
    {
      h: "2. Vacunas y salud",
      p: `Antes de una primera visita, le pedimos al dueño que confirme las vacunas de la mascota (la de la rabia y otras que recomiende el veterinario) y cualquier necesidad médica. Usted puede rechazar cualquier mascota que no las tenga al día. Administre medicamentos solo según las instrucciones escritas del dueño. Lávese las manos entre una mascota y otra y entre un patio y otro.`,
    },
    {
      h: "3. Animales agresivos o peligrosos",
      p: `Si un animal se comporta de forma agresiva o usted se siente inseguro, no entre o detenga la visita, póngase a salvo y avise al dueño y a nosotros. Puede rechazar cualquier animal, en cualquier momento. Esto nunca cuenta en su contra.`,
    },
    {
      h: "4. Emergencias",
      p: `Si una mascota está herida, enferma, perdida o fue mordida: ponga a la mascota (y a usted mismo) a salvo, llame al dueño y llámenos. Si no se puede localizar al dueño y la mascota necesita atención urgente, llévela al veterinario indicado por el dueño o a la clínica veterinaria de emergencia más cercana. ${N} puede autorizar el tratamiento hasta el monto que el dueño aceptó en el anexo de cuidado de mascotas para clientes; usted nunca paga las cuentas del veterinario. Reporte cualquier mordedura a nosotros y según lo exija la ley local.`,
    },
    {
      h: "5. Clima",
      p: `En calor extremo (en general, 85°F o más con alta humedad), frío extremo (en general, menos de 20°F o condiciones de hielo) o tormentas, acorte los paseos, evite el pavimento caliente y la sal para derretir hielo, y mantenga a la mascota segura bajo techo cuando sea posible. Dígale al dueño lo que hizo.`,
    },
    {
      h: "6. Llaves, cajas de seguridad y desechos de mascotas",
      p: `Las llaves y los códigos se usan solo para esa visita, nunca se copian y se devuelven cuando termina el servicio. Cierre todo como lo encontró. Embolse los desechos de las mascotas y deséchelos como indique la orden de trabajo (en el contenedor del cliente o en el suyo), nunca en un desagüe pluvial.`,
    },
  ]),

  "pro-addendum-events-food": addendum("Eventos, Alimentos y Lugares para Eventos", ["event_planner", "catering", "food_truck", "dj_music", "rentals", "venue"], [
    "El servicio de alimentos requiere su licencia del departamento de salud o del MDARD y un gerente certificado en protección de alimentos; quienes manipulan alimentos siguen el Código de Alimentos de Michigan.",
    "Etiquete los alérgenos y mantenga los alimentos a temperaturas seguras.",
    "Alcohol solo con la licencia correspondiente de la MLCC y seguro de responsabilidad por venta de alcohol, servido por personal capacitado; nunca a menores de 21 años ni a personas visiblemente intoxicadas.",
    "Siga las normas del lugar, los límites de capacidad, las ordenanzas de ruido y las normas de permisos. Instale todo de forma segura, especialmente el sonido, la electricidad y las carpas.",
    "Alquileres: inspeccione y tome fotos en la entrega y en la recogida. Coordine con el organizador del evento.",
  ], [
    {
      h: "1. Licencias de alimentos e inocuidad alimentaria",
      p: `Los servicios de catering necesitan una licencia de servicio de alimentos del departamento de salud del condado; los food trucks necesitan una licencia de establecimiento móvil de alimentos (MDARD / condado). Cada operación necesita un gerente certificado en protección de alimentos, y todas las personas que manipulan alimentos siguen el Código de Alimentos de Michigan: lavado de manos, temperaturas de conservación en caliente y en frío, nada de contacto con las manos desnudas con alimentos listos para comer, y quedarse en casa cuando estén enfermos. Mantenga su inspección más reciente registrada con nosotros.`,
    },
    {
      h: "2. Alérgenos",
      p: `Etiquete cada platillo con los principales alérgenos (leche, huevo, pescado, mariscos, frutos secos, cacahuates/maní, trigo, soya y ajonjolí) y con lo que el cliente solicitó (vegano, halal, kosher, sin gluten). Evite el contacto cruzado en los pedidos aptos para alérgicos, y nunca afirme que un platillo no contiene alérgenos a menos que esté seguro.`,
    },
    {
      h: "3. Alcohol",
      p: `Sirva alcohol solo cuando usted (o el lugar) tenga la licencia o el permiso correspondiente de la Comisión de Control de Licores de Michigan (MLCC) para ese evento, cuente con seguro de responsabilidad por venta de alcohol (${t("es", COVERAGES.liquor.detail).split(".")[0]}), y use personal de servicio con capacitación en servicio responsable (como TIPS o ServSafe Alcohol). Verifique la identificación; nunca sirva a menores de 21 años ni a nadie visiblemente intoxicado; detenga el servicio a la hora acordada. Puede negarle el servicio a cualquier persona, y hacerlo nunca cuenta en su contra.${COUNSEL}`,
    },
    {
      h: "4. Lugares para eventos",
      p: `Los dueños de los lugares mantienen vigente un certificado de ocupación, respetan la capacidad indicada, mantienen despejadas las salidas, el equipo contra incendios y las rutas accesibles, e informan al cliente las normas del lugar con anticipación. Los proveedores siguen las normas del lugar sobre carga y descarga, llamas abiertas, decoración, ruido y horarios de cierre.`,
    },
    {
      h: "5. Sonido, iluminación y electricidad",
      p: `Instale el equipo de forma segura: asegure las bocinas y los soportes, fije con cinta o cubra los cables que crucen los pasillos, no sobrecargue los circuitos, mantenga los líquidos lejos del equipo, y use equipo resistente a la intemperie y protección GFCI al aire libre. Siga las ordenanzas locales de ruido y los límites de sonido y horarios de cierre del lugar.`,
    },
    {
      h: "6. Alquileres: entrega, instalación y recogida",
      p: `Entregue y recoja dentro de los horarios acordados. Instale carpas, tarimas e inflables según las instrucciones del fabricante, anclados contra el viento, con cualquier permiso de carpa requerido (y llame al 811 antes de clavar estacas en el suelo cuando se requiera). Supervise o explique al cliente las normas de seguridad de los inflables. Fotografíe los artículos en la entrega y en la recogida; reporte daños o artículos faltantes a través de la aplicación dentro de las 24 horas siguientes a la recogida para que lo resolvamos con el cliente; no les cobre directamente a los clientes.`,
    },
    {
      h: "7. Trabajo con el organizador",
      p: `Tenga todo instalado y listo antes de la hora de inicio del evento. Coordine los horarios, la electricidad, la carga y descarga y los cambios con el organizador del evento en el lugar (o con nosotros si no lo hay). La coordinación del organizador tiene que ver con el horario del evento que fijó el cliente; cómo hace usted su propio trabajo sigue dependiendo de usted.`,
    },
  ]),

  "pro-addendum-errands-delivery": addendum("Mandados y Entregas", ["errands"], [
    "Gaste el dinero del cliente o de la empresa solo en lo que el cliente pidió, y suba cada recibo.",
    "Nunca use fondos, tarjetas ni artículos del cliente para nada personal. No maneje dinero en efectivo.",
    "Los artículos con restricción de edad (alcohol, tabaco, vapeadores, cannabis, algunos medicamentos) requieren verificar la identificación al entregarlos: 21 años o más cuando la ley lo indique.",
    "Mantenga fríos los alimentos fríos y calientes los calientes; no entregue nada que no sea seguro.",
    "Su seguro de auto debe cubrir el uso comercial o de entregas; las pólizas personales a menudo lo excluyen.",
  ], [
    {
      h: "1. Compras",
      p: `Compre solo lo que el cliente indicó (o las sustituciones aprobadas en la aplicación), hasta el límite de compras del trabajo (actualmente ${money(P.materials.shoppingMax)} sin una aprobación adicional del cliente). Suba un recibo detallado de cada compra. El reembolso es al costo; nunca le pagamos más que el recibo y usted nunca paga los artículos del cliente con su pago.`,
    },
    {
      h: "2. Fondos y artículos del cliente",
      p: `Nunca use el dinero, la tarjeta, la cuenta ni los artículos de un cliente o nuestros para nada personal, y nunca se quede con el cambio, puntos de recompensa ni extras que pertenezcan al cliente. No acepte ni lleve dinero en efectivo de un cliente; todos los pagos se hacen a través de la aplicación.`,
    },
    {
      h: "3. Artículos con restricción de edad",
      p: `Entregue alcohol, tabaco, productos para vapear, cannabis u otros artículos con restricción de edad solo donde la ley y el vendedor lo permitan, y solo al cliente (o a un adulto que el cliente haya indicado) después de verificar una identificación con foto válida que demuestre que tiene la edad legal (21 años o más para alcohol, tabaco y cannabis). Si no puede mostrar su identificación o parece intoxicado, no lo entregue: devuélvalo según indique la aplicación.`,
    },
    {
      h: "4. Inocuidad alimentaria",
      p: `Mantenga los productos perecederos en bolsas térmicas o hieleras, entréguelos con prontitud y no los deje en un auto caliente o helado. No entregue artículos dañados, en mal estado, retirados del mercado o vencidos: avise al cliente en la aplicación y déjele elegir un sustituto o un reembolso.`,
    },
    {
      h: "5. Seguro del vehículo",
      p: `Si maneja para los trabajos, su seguro de auto debe cubrir el uso comercial o de entregas. Muchas pólizas personales lo excluyen; obtenga un endoso de uso comercial o de entregas o una póliza comercial, y mantenga el comprobante registrado. Sin él, se detienen las ofertas de trabajos que implican manejar.`,
    },
  ]),

  "pro-addendum-hauling": addendum("Acarreo, Retiro de Basura y Contenedores", ["hauling", "dumpster"], [
    "Deseche todo legalmente en instalaciones con licencia, y suba los recibos o boletas de pesaje.",
    "No acepte artículos prohibidos (desechos peligrosos; llantas y electrodomésticos solo donde se permita, etc.).",
    "Las donaciones van solo a donde el cliente aceptó, con un recibo.",
    "Asegure y cubra con lona cada carga. Respete los límites de peso.",
    "Coloque los contenedores con cuidado, con permisos si van en la calle, y proteja las entradas de vehículos y el césped.",
  ], [
    {
      h: "1. Desecho legal",
      p: `Lleve todo a rellenos sanitarios, estaciones de transferencia o centros de reciclaje con licencia y suba el recibo o la boleta de pesaje. Tirar basura ilegalmente da lugar a la desactivación inmediata, y usted paga cualquier multa y la limpieza. Recicle electrodomésticos, aparatos electrónicos, metal y llantas cuando la ley lo exija, y retire el refrigerante de los electrodomésticos solo a través de un técnico o una instalación certificados.`,
    },
    {
      h: "2. Artículos prohibidos",
      p: `No acepte desechos peligrosos (pintura, solventes, productos químicos, tanques de propano, asbesto, desechos médicos, municiones) a menos que tenga licencia y el equipo para manejarlos. Si los encuentra, déjelos y avise al cliente y a nosotros; le indicaremos al cliente una opción adecuada para desecharlos.`,
    },
    {
      h: "3. Donaciones y artículos del cliente",
      p: `Lleve artículos a donación o reventa solo cuando el cliente lo haya aceptado en la aplicación, y suba el recibo de donación para el cliente. Nunca se quede con los artículos de un cliente, ni los venda o regale para su propio beneficio. No se lleve nada que no esté en la lista del trabajo sin la aprobación del cliente.`,
    },
    {
      h: "4. Cargas, peso y colocación",
      p: `Asegure y cubra con lona cada carga para que nada se caiga ni salga volando. Respete los límites de peso de su vehículo y del contenedor; los cargos por sobrepeso se trasladan al cliente solo si la forma en que el cliente cargó los causó y la orden de trabajo así lo indica. Coloque los contenedores donde el cliente eligió, usando tablas para proteger las entradas de vehículos; obtenga el permiso de la ciudad antes de colocarlos en una calle o acera. Fotografíe el área antes y después de la colocación y de la recogida.`,
    },
  ]),

  "pro-addendum-outdoor-and-heights": addendum("Trabajo al Aire Libre, Árboles, Nieve y Alturas", ["lawn", "tree", "snow", "gutters", "pressure_washing", "windows"], [
    "Use correctamente las escaleras y la protección contra caídas; siempre puede negarse a trabajar en alturas inseguras.",
    "El trabajo con árboles sigue los principios básicos de seguridad de ANSI Z133. Manténgase al menos a 10 pies de los cables eléctricos, siempre.",
    "Llame al 811 antes de excavar, clavar estacas o triturar tocones.",
    "Nieve: marque los obstáculos, use la sal con sensatez y siga la condición de activación y los horarios de la orden de trabajo.",
    "Use los productos químicos según la etiqueta, con certificado de aplicador del MDARD cuando se requiera. Evite que los escurrimientos lleguen a los desagües pluviales.",
  ], [
    {
      h: "1. Escaleras y protección contra caídas",
      p: `Use escaleras con capacidad para la carga, sobre una base nivelada, en un ángulo seguro y con tres puntos de contacto; asegure o amarre las escaleras extensibles. Use protección contra caídas al trabajar en techos o en alturas donde OSHA lo exija. Puede rechazar cualquier trabajo, o parte de un trabajo, que considere inseguro en altura: avísenos y no contará en su contra.`,
    },
    {
      h: "2. Trabajo con árboles y cables eléctricos",
      p: `El trabajo con árboles sigue las normas de seguridad ANSI Z133 (equipo de protección personal, seguridad con motosierras, aparejos, zonas de trabajo y un equipo calificado). Manténgase —y mantenga las herramientas, cuerdas, ramas y equipos— al menos a 10 pies de los cables eléctricos aéreos; si un árbol está cerca de un cable o lo toca, deténgase y llame a la compañía de servicios. Trabaje cerca de los cables solo con un arborista calificado en despeje de líneas, cuando la ley lo permita. Proteja las estructuras, el césped y las entradas de vehículos; obtenga permisos para árboles en la vía pública o trabajos en el derecho de vía cuando se requiera.`,
    },
    {
      h: "3. Llame al 811 antes de excavar",
      p: `Antes de excavar, clavar estacas, airear a profundidad, instalar postes o triturar tocones, comuníquese con MISS DIG 811 con al menos 3 días hábiles de anticipación (como lo exige la ley de Michigan) y respete las marcas. Las líneas privadas (rociadores, cercas invisibles, iluminación) no las marca el 811: pregunte al cliente.`,
    },
    {
      h: "4. Nieve y hielo",
      p: `Coloque marcadores para el quitanieves antes de la temporada (o de la primera visita) y anote los obstáculos. Siga la profundidad de activación y los horarios de la orden de trabajo (por ejemplo, quitar la nieve a partir de 2 pulgadas y terminar a la hora indicada). Use la sal y el derretidor de hielo con sensatez; evite los productos peligrosos para mascotas cuando la orden de trabajo indique que hay mascotas. No empuje la nieve hacia las calles, las aceras ni la propiedad de los vecinos. Fotografíe las condiciones al terminar.`,
    },
    {
      h: "5. Productos químicos y escurrimientos",
      p: `Aplique fertilizantes, herbicidas y pesticidas solo según las indicaciones de la etiqueta, y solo con la certificación de aplicador comercial del MDARD cuando Michigan lo exija. Coloque los avisos requeridos. En el lavado a presión y el lavado suave, proteja las plantas, cubra los enchufes y los accesorios, y evite que el agua de lavado y los productos químicos lleguen a los desagües pluviales, según lo exijan las normas locales.`,
    },
  ]),

  "pro-addendum-home-services": addendum("Limpieza, Alfombras, Organización y Detallado de Autos", ["cleaning", "carpet", "organizing", "auto_detailing"], [
    "Use los productos según su etiqueta y su hoja de datos de seguridad (SDS); nunca mezcle productos químicos.",
    "Maneje con cuidado las pertenencias del cliente y reporte de inmediato cualquier rotura con fotos.",
    "Nunca tire nada sin la aprobación clara del cliente.",
    "Detallado de autos: fotografíe el estado del vehículo antes de comenzar.",
  ], [
    {
      h: "1. Productos químicos",
      p: `Use los productos según sus etiquetas y tenga sus hojas de datos de seguridad (SDS) disponibles en su teléfono o en su vehículo. Nunca mezcle productos químicos (por ejemplo, cloro y amoníaco). Ventile, use guantes y protección para los ojos según indique la etiqueta, y mantenga los productos lejos de los niños y las mascotas. Use los productos que solicite el cliente (por ejemplo, sin fragancia) cuando la orden de trabajo lo indique.`,
    },
    {
      h: "2. Pertenencias del cliente",
      p: `Mueva los objetos con cuidado y vuelva a ponerlos donde estaban. No limpie ni trate objetos de valor, obras de arte, antigüedades ni aparatos electrónicos a menos que la orden de trabajo los incluya. Reporte de inmediato en la aplicación, con fotos, cualquier cosa rota o dañada: reportar con honestidad siempre es mejor que que se descubra después.`,
    },
    {
      h: "3. Desechar objetos",
      p: `Nunca tire, done ni retire nada a menos que el cliente lo haya aprobado claramente en la aplicación o en la orden de trabajo. Al organizar o vaciar espacios, separe en montones de conservar, donar y desechar, y obtenga la aprobación del cliente antes de que algo salga. Trate con cuidado los objetos delicados (documentos, fotos, medicamentos) y triture documentos solo a petición del cliente.`,
    },
    {
      h: "4. Vehículos",
      p: `Antes de comenzar un detallado, recorra el vehículo y fotografíe los rayones, abolladuras, manchas y daños existentes, y anótelos en la aplicación. Retire los objetos personales y devuélvalos al cliente, nunca se quede con nada que encuentre en un vehículo, y no maneje el vehículo a menos que la orden de trabajo lo permita. Siga las normas locales sobre escurrimiento de agua; use un sistema autónomo de recolección de agua cuando se requiera.`,
    },
  ]),
  "pro-crew-addendum": {
    title: "Anexo de Equipo de Trabajo",
    appliesTo: `Empresas de profesionales que envían a miembros de su equipo (ayudantes, aprendices, jefes de cuadrilla o técnicos con licencia) a trabajos de ${N}; forma parte del Contrato de Contratista Independiente.`,
    summary: [
      "Su equipo trabaja para su empresa, no para nosotros. Usted los elige, los dirige, organiza sus horarios y les paga.",
      "Usted confirma que cada miembro de su equipo tiene permiso legal para trabajar en los Estados Unidos, y conserva sus formularios I-9 y registros de nómina.",
      "Usted tiene seguro de accidentes laborales (workers' compensation) para su equipo antes de que cualquiera de ellos haga un trabajo.",
      "Todas las personas que envíe deben estar registradas en la aplicación y aprobar primero nuestra verificación de antecedentes.",
      "El trabajo que requiere licencia solo se envía a un miembro del equipo que tenga la licencia (o lo hace usted). Los ayudantes nunca van solos.",
      "Usted es responsable del trabajo y la conducta de su equipo, igual que de los suyos. Su pago cubre todo el trabajo; usted le paga a su equipo.",
    ],
    sections: [
      {
        h: "1. Su equipo, su negocio",
        p: `Este anexo complementa el Contrato de Contratista Independiente (sección sobre ayudantes) cuando su empresa envía a trabajos de ${N} a personas distintas de usted. Los miembros de su equipo son sus empleados o sus propios subcontratistas. Usted los elige y decide quién va a cada trabajo, cómo trabajan, sus horarios, su pago y sus herramientas. No son empleados ni contratistas de ${N}, y nosotros no los dirigimos, no organizamos sus horarios, no los capacitamos ni les pagamos. Le pagamos a su empresa por el trabajo; usted le paga a su equipo completo y a tiempo, como lo exige la ley.`,
      },
      {
        h: "2. Permiso para trabajar, nómina e impuestos",
        p: `Al registrar a un miembro de su equipo, usted confirma que tiene permiso legal para trabajar en los Estados Unidos, que completó y conserva el Formulario I-9 de cada empleado (y, si usa E-Verify, sus registros), y que usted se encarga de sus salarios, horas extra, impuestos sobre la nómina, retenciones y formularios de impuestos. No registre ni envíe a nadie que usted sepa que no está autorizado para trabajar. Podemos pedirle que lo confirme por escrito en cualquier momento; no recopilamos ni guardamos los documentos migratorios de su equipo.${COUNSEL}`,
      },
      {
        h: "3. Seguro de accidentes laborales y otros seguros",
        p: `Antes de que cualquier miembro de su equipo haga un trabajo de ${N}, usted debe tener un seguro de accidentes laborales (workers' compensation) que lo cubra (la declaración de que no tiene empleados deja de aplicar en cuanto tiene un equipo) y subir un certificado vigente. Su seguro de responsabilidad civil general debe cubrir el trabajo que haga su equipo. No se puede enviar a ningún miembro del equipo a un trabajo mientras su certificado de accidentes laborales falte o esté vencido.`,
      },
      {
        h: "4. Verificación de antecedentes y registro",
        p: `Por la seguridad del cliente, todas las personas que usted envíe deben estar registradas en la aplicación con su nombre real y aprobar nuestra verificación de antecedentes antes de entrar a la casa o negocio de un cliente, la misma verificación que usted aprobó. Cada miembro del equipo autoriza la verificación personalmente con nuestro proveedor. Los resultados nos llegan a nosotros; si un resultado necesita revisión, seguimos el proceso de acción adversa que exige la ley antes de tomar cualquier decisión. Nunca lleve a un trabajo a alguien que no esté registrado y aprobado. Quite a un miembro del equipo de su lista el mismo día en que deje de trabajar para usted.`,
      },
      {
        h: "5. Trabajo con licencia y quién va solo",
        p: `El trabajo que legalmente requiere licencia (por ejemplo, plomería, electricidad o calefacción y aire acondicionado) solo se envía a un miembro del equipo cuya propia licencia esté registrada, o lo hace usted como titular de la licencia. Los aprendices trabajan solo junto a un técnico con licencia, como lo exige la ley de Michigan. Los ayudantes van con usted o con un jefe de cuadrilla; nunca se les envía solos a un trabajo. Elija en la aplicación quién va antes del trabajo, para que el cliente sepa quién llegará.`,
      },
      {
        h: "6. Responsabilidad",
        p: `Usted es responsable del trabajo, la conducta, la seguridad y el cumplimiento del Código de Conducta por parte de su equipo, igual que si usted mismo hiciera el trabajo. Los reembolsos por mano de obra y los daños causados por su equipo se manejan según el proceso de reembolsos y deducciones del contrato. Los reclamos de su equipo contra usted o contra nosotros (incluidos los reclamos de salarios o de clasificación) están cubiertos por la sección de indemnización del contrato. Las calificaciones y la situación de la cuenta se aplican a su empresa en conjunto.`,
      },
    ],
  },
  "pro-rewards-terms": {
    title: "Términos de Recompensas (Recompensas Handled Pro)",
    appliesTo: `Todo profesional que completa trabajos a través de ${N}; anexo del Contrato de Contratista Independiente.`,
    summary: [
      `Un agradecimiento gratuito además del pago de sus trabajos: puntos en cada trabajo completado, según lo que Handled gana en él.`,
      `Más por un gran trabajo (×1.25) y más mientras más tiempo se queda (hasta ×1.5), además de bonos por metas.`,
      `Los puntos nunca dependen de aceptar o rechazar ofertas.`,
      `Los puntos nuevos quedan pendientes 90 días; los trabajos reembolsados no ganan puntos.`,
      `Solo se canjean por premios del catálogo, sin valor en efectivo. Los premios son ingreso y aparecen en su 1099.`,
      `Los puntos vencen tras 12 meses sin un trabajo completado; solo se pierden si su cuenta se desactiva por causa.`,
    ],
    sections: [
      { h: `1. Qué es el programa`, p: `Recompensas Handled Pro es un programa de lealtad para profesionales independientes que completan trabajos a través de ${N}. Es un agradecimiento además del pago de sus trabajos: no es pago por ningún trabajo, no es un salario, no es propiedad ni una participación en la empresa, ni una inversión. La inscripción es automática y gratuita; no tiene que hacer nada para participar y puede ignorarlo.` },
      { h: `2. Cómo se ganan puntos`, p: `Gana puntos en cada trabajo completado según la cantidad que ${N} conserva de ese trabajo después de su pago (nuestra parte), actualmente 10 puntos por cada $1. Un trabajo que pasa la revisión a la primera, sin repetición ni reembolso y con una calificación de 4.8★ o más (o sin calificación), gana 1.25×. Su tiempo con nosotros gana más: 1.1× después de 6 meses, 1.25× después de 1 año y 1.5× después de 2 años, contados desde su primer trabajo completado. Las metas (por ejemplo 10, 50 y 100 trabajos completados, aniversarios y reseñas de cinco estrellas) dan puntos extra.

Los puntos nunca dependen de aceptar, rechazar o ignorar ofertas, de su horario ni de cuántas horas trabaja. Las propinas, reembolsos y pagos por presentarse no ganan puntos.` },
      { h: `3. Puntos pendientes y disponibles`, p: `Los puntos nuevos de trabajos quedan pendientes 90 días. Cuando pasan a disponibles se aplican los multiplicadores finales: un trabajo reembolsado no gana puntos y un trabajo que necesitó repetición no recibe el bono de calidad. Los montos pendientes que se muestran antes son estimados.` },
      { h: `4. Canje`, p: `Los puntos disponibles solo se pueden canjear por los premios del catálogo en la app y el portal de profesionales (por ejemplo artículos, tarjetas de regalo, herramientas, electrónicos y viajes). Los puntos no tienen valor en efectivo, no se pueden cambiar por dinero, vender, transferir ni combinar con los de otro profesional, y no son propiedad. Su cuenta debe estar activa para canjear. Pedimos y enviamos los premios a la dirección que nos dé; los tiempos de entrega varían. Si un premio no está disponible, podemos ofrecerle uno similar o devolverle sus puntos.` },
      { h: `5. Impuestos`, p: `Los premios son ingreso. Reportamos el valor justo de mercado de los premios que se le entregan en su Formulario 1099 de ese año, junto con el pago de sus trabajos, usando el W-9 que nos dio. Usted es responsable de los impuestos. Consulte a un profesional de impuestos si tiene preguntas.` },
      { h: `6. Vencimiento y pérdida`, p: `Los puntos vencen si no completa ningún trabajo durante 12 meses seguidos. Si su cuenta se desactiva por causa según la Política de Desactivación (después de cualquier apelación), pierde sus puntos pendientes y disponibles. Terminar la relación por cualquier otro motivo no le hace perder los puntos disponibles: tiene 90 días para canjearlos.` },
      { h: `7. Cambios`, p: `Podemos cambiar la tasa de puntos, los multiplicadores, las metas, el catálogo y los precios en puntos, o terminar el programa, con al menos 30 días de aviso en la app o por correo. Los cambios nunca le quitan puntos que ya ganó: si terminamos el programa, tendrá al menos 90 días para canjear sus puntos disponibles (y los pendientes cuando pasen a disponibles).` },
      { h: `8. Otros términos`, p: `Podemos corregir errores en su saldo y anular puntos obtenidos mediante fraude o abuso. Cuando este anexo y el Contrato de Contratista Independiente difieran sobre las recompensas, prevalece este anexo. Nulo donde la ley lo prohíba.` },
    ],
  },
};
