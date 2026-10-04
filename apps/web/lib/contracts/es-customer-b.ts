/*
 * FILE    : apps/web/lib/contracts/es-customer-b.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0048 UTC
 * PURPOSE : Spanish (neutral Latin-American, formal "usted") translations of the business
 *           contract, Plus/gift cards/promos terms and every customer service addendum:
 *             business-services-agreement, plus-gift-cards-promos, addendum-* (CUSTOMER_ADDENDA)
 *           Same section count, order and numbering as customer.ts; numbers come from
 *           @handled/core so both languages render the same figures. English controls.
 *           TEMPLATES — not legal advice.
 * UPDATED : 2026-10-03_0152 UTC — market pricing (Business MSA: precio sugerido y ofertas salvo que un Pedido
 *           fije el precio; Plus/promos: el cargo de reserva no se descuenta), mirroring customer.ts.
 * UPDATED : 2026-10-03_1311 UTC — adenda de construcción: el equipo que el cliente compra debe ser nuevo; nunca instalamos usado.
 * UPDATED : 2026-10-04_1934 UTC — adenda de retiro: mudanzas pequeñas, entregas de objetos grandes y muebles de decoración (nueva sección "Mudanzas y entregas"); MSA: plazos aprobados en el portal de la cuenta empresarial.
 */
import {
  BOOKING_FEE,
  BRAND,
  DEPOSIT,
  DISCOUNT_FLOOR,
  HANDLED_PLUS,
  LATE_CANCEL_FEE,
  PRO_POLICY_DEFAULTS,
  REFERRAL,
  TIP_MAX,
  money,
  t,
} from "@handled/core";
import type { ContractSection, ContractTranslation } from "./types";

// ─── helpers (mirror customer.ts) ─────────────────────────────────────────────
const COUNSEL = " [Confirmar con un abogado.]";
const pct = (x: number) => `${Math.round(x * 100)}%`;
const p = (...paras: string[]) => paras.join("\n\n");
const ul = (...items: string[]) => items.map((i) => `• ${i}`).join("\n");
const numbered = (items: [string, string][]): ContractSection[] => items.map(([h, body], i) => ({ h: `${i + 1}. ${h}`, p: body }));

const US = `${BRAND.legalName} ("${BRAND.name}", "nosotros")`;
const MATERIALS_OK = money(PRO_POLICY_DEFAULTS.materials.autoApproveUpTo);
const SHOPPING_MAX = money(PRO_POLICY_DEFAULTS.materials.shoppingMax);
const FEE = money(BOOKING_FEE);
const ADDENDUM_INTRO = "Este anexo complementa el Acuerdo de Servicio para los servicios indicados. Si hay un conflicto, este anexo prevalece para esos servicios.";

export const CUSTOMER_ES_B: Record<string, ContractTranslation> = {
  // ══════════════════════════════════════════════════════════════════════════
  // BUSINESS SERVICES AGREEMENT
  // ══════════════════════════════════════════════════════════════════════════
  "business-services-agreement": {
    title: `${BRAND.legalName} — Acuerdo de Servicios para Empresas`,
    appliesTo: "Cuentas empresariales (oficinas, comercios, restaurantes, clínicas, administradores de propiedades, asociaciones de propietarios (HOA), locales para eventos y otras organizaciones); se acepta al abrir la cuenta o al firmar un formulario de pedido.",
    summary: [
      "Este es el acuerdo marco de su cuenta empresarial. Cada formulario de pedido, propuesta o reserva es un trabajo independiente bajo este acuerdo.",
      "Por defecto, se paga por adelantado con tarjeta o ACH. Plazos de pago a crédito solo si un formulario de pedido lo indica.",
      "Cada profesional tiene verificación de antecedentes, seguro y licencia cuando el oficio lo exige. Certificados de seguro a solicitud.",
      "Mantenemos confidenciales sus llaves, códigos e información, y usted hace lo mismo con los nuestros. Información de pacientes solo con un BAA de HIPAA firmado.",
      "Los niveles de servicio son metas. Si no los cumplimos, repetimos el trabajo o le damos un crédito.",
      "Por favor, no contrate directamente a nuestros profesionales durante 12 meses; de lo contrario, se aplica un cargo por conversión.",
      "Cualquiera de las partes puede terminar el acuerdo con 30 días de aviso, o de inmediato por un incumplimiento grave.",
      "Ley de Michigan. Tribunales del condado de Wayne (Wayne County). Sin arbitraje obligatorio para empresas.",
    ],
    sections: numbered([
      ["Partes y estructura", p(
        `Este Acuerdo de Servicios para Empresas ("Acuerdo") se celebra entre ${US} y la empresa u organización indicada en la cuenta o en el formulario de pedido ("Cliente", "usted").`,
        "Este Acuerdo establece los términos generales. Cada formulario de pedido, propuesta firmada, calendario de servicio recurrente o reserva hecha a través de su cuenta empresarial es una orden de trabajo (un \"Pedido\"). Cada Pedido describe los servicios, los sitios, el calendario y el precio. Cada Pedido forma parte de este Acuerdo.",
        "El Acuerdo de Servicio para clientes y los anexos de servicio también se aplican a cada Pedido, excepto cuando este Acuerdo o el Pedido digan algo distinto.",
      )],
      ["Lo que ofrecemos", p(
        `${BRAND.name} administra servicios para instalaciones y empresas a través de profesionales independientes verificados y empresas con licencia. Estos incluyen limpieza y conserjería, exteriores y áreas verdes (incluidas nieve y hielo), reparaciones y mantenimiento por oficios con licencia, pintura y adecuaciones de locales, vaciado de espacios y retiro de cargas, mensajería y mensajería médica, transporte corporativo, eventos corporativos y catering, y detallado de flotas de vehículos.`,
        "Programamos, despachamos, supervisamos la calidad (visitas con registro de hora y fotos de antes y después), gestionamos los trabajos repetidos y enviamos informes. Si un profesional no puede asistir a una visita, la reasignamos a otro profesional calificado.",
      )],
      ["Usuarios autorizados", p(
        "Usted puede agregar personas a su cuenta para reservar, aprobar órdenes de cambio y recibir informes (\"usuarios autorizados\"). Usted es responsable de lo que hagan en su cuenta, incluidas reservas y aprobaciones.",
        "Retire el acceso de una persona cuando deje su empresa. Las reservas hechas por un usuario autorizado antes de retirarle el acceso son obligatorias.",
        "Usted puede fijar límites de aprobación en el Pedido. Las órdenes de cambio por encima de ese límite necesitan la aprobación de la persona indicada en el Pedido.",
      )],
      ["Pedidos, alcance y cambios", p(
        "Cada Pedido enumera el trabajo incluido. El trabajo no enumerado no está incluido. Si las condiciones del sitio son distintas de lo que se nos informó, enviamos una orden de cambio con precio según nuestras tarifas estándar. El trabajo adicional se hace solo después de que un usuario autorizado lo apruebe.",
        `Precios: a menos que un Pedido fije el precio, las reservas hechas a través de su cuenta empresarial usan el mismo proceso de precio sugerido y ofertas del Acuerdo de servicio para clientes. Mostramos un precio sugerido, un usuario autorizado puede ofrecer un precio diferente dentro de los límites que se muestran, los profesionales pueden hacer contraofertas, y el precio mostrado incluye un cargo de reserva fijo de ${FEE} por reserva (por visita en los servicios recurrentes). Cuando un Pedido fija el precio, se aplica ese precio.`,
        "Los servicios recurrentes continúan según el calendario del Pedido hasta que el Pedido termine o se modifique. Cualquiera de las partes puede cambiar un calendario recurrente con 14 días de aviso; los cambios de precio entran en vigor en el siguiente período de facturación después del aviso.",
      )],
      ["Facturación y pago", p(
        ul(
          "Por defecto: el trabajo se paga por adelantado con tarjeta o ACH. Los servicios recurrentes se cobran antes de cada visita o período de facturación.",
          "Plazos de pago a crédito: solo si un Pedido lo indica por escrito (por ejemplo, a 15 o a 30 días), después de una evaluación de crédito. Los plazos que aprobemos para su cuenta empresarial, indicados en el portal de su cuenta con un límite de crédito, cuentan como ese Pedido. Una reserva que supere el límite de crédito, o que se haga mientras una factura tenga más de 10 días de atraso, se paga al reservar. Las facturas vencen en la fecha indicada.",
          "Números de orden de compra (PO) y centros de costo: los pondremos en las facturas si nos los proporciona. La falta de un número de PO no retrasa el pago.",
          "Pago atrasado: los montos no pagados con plazo de crédito generan un cargo por mora del 1.5% mensual (o la tasa más alta que permita la ley, si es menor) desde la fecha de vencimiento. Podemos pausar el servicio después de 10 días de aviso por escrito por falta de pago, y exigir pago por adelantado a partir de entonces." + COUNSEL,
          "Disputas: infórmenos por escrito sobre una disputa de facturación dentro de los 30 días siguientes a la factura. Pague a tiempo la parte que no está en disputa. Trabajaremos de buena fe para resolver el resto.",
          "Impuestos: los precios no incluyen impuestos. Usted paga los impuestos sobre las ventas y otros impuestos similares que correspondan, a menos que nos entregue un certificado de exención válido.",
          "Cobranza: si debemos recurrir a una agencia de cobranza o a los tribunales para recuperar montos vencidos, usted pagará los costos razonables de cobranza y los honorarios de abogados.",
        ),
      )],
      ["Cancelaciones y acceso", p(
        `Las visitas se pueden reprogramar o cancelar sin costo con más de 24 horas de anticipación al horario programado. Dentro de las 24 horas, o si nuestro profesional no puede entrar (puertas cerradas, códigos incorrectos, nadie para recibirlo), se aplica un cargo por visita fallida de ${money(LATE_CANCEL_FEE)} por visita, a menos que el Pedido indique otro monto.`,
        "Las cancelaciones de eventos, transporte y proyectos siguen el anexo de ese servicio o el Pedido.",
      )],
      ["Nuestros profesionales: verificación y seguro", p(
        "Cada profesional que enviamos ha pasado una verificación de antecedentes y tiene un seguro de responsabilidad civil general de al menos $1,000,000 por incidente (más alto para algunos oficios), además de la cobertura que exige su oficio, como seguro de auto comercial, responsabilidad civil de transportista de pasajeros, compensación laboral cuando tiene empleados, fianzas de fidelidad para acceso sin supervisión y responsabilidad por venta de alcohol cuando se sirve alcohol. Los oficios con licencia tienen la licencia que su trabajo exige.",
        `Le daremos certificados de seguro a solicitud, y podemos pedir a los profesionales que lo incluyan a usted como asegurado adicional cuando su aseguradora lo permita. Los profesionales incluyen a ${BRAND.legalName} como asegurado adicional.`,
        "Los profesionales son contratistas independientes, no empleados nuestros ni suyos. No tienen derecho a los beneficios de sus empleados, y usted no dirigirá su trabajo más allá del alcance, las reglas del sitio y las necesidades de seguridad.",
      )],
      ["Reglas del sitio, llaves y códigos de acceso", p(
        "Infórmenos sus reglas del sitio (horario, registro de entrada, equipo de protección personal, áreas restringidas, procedimientos de alarma, estacionamiento). Las compartiremos con cada profesional y le exigiremos que las cumpla.",
        "Las llaves, credenciales, llaveros electrónicos y códigos de alarma que nos entregue se guardan de forma segura, se registran y se comparten solo con el profesional asignado a la visita, y solo durante el tiempo necesario. Avísenos de inmediato si cambia un código o quiere que le devolvamos una llave. Si una llave o credencial que tenemos se pierde por culpa nuestra o de un profesional, pagamos el costo razonable de cambiar la cerradura o reemplazarla.",
        "Usted es responsable de proteger el dinero en efectivo, los documentos confidenciales y los objetos de valor. Por favor, no dé a los profesionales acceso a áreas que no necesitan.",
      )],
      ["Confidencialidad", p(
        "Cada parte puede conocer información confidencial de la otra, como precios, planes de negocio, listas de clientes, planos de edificios, procedimientos de seguridad y códigos de acceso. Cada parte usará la información confidencial de la otra solo para cumplir este Acuerdo, la protegerá con un cuidado razonable y la compartirá solo con personas que la necesiten y estén obligadas a mantenerla confidencial (incluidos nuestros profesionales).",
        "Esto no cubre información que sea pública, ya conocida, creada de forma independiente o recibida legítimamente de otra persona. Cualquiera de las partes puede divulgar información cuando la ley lo exija, después de dar aviso cuando esté permitido.",
        "Estas obligaciones duran 3 años después de que termine el Acuerdo y, en el caso de secretos comerciales e información de acceso, mientras sigan siendo confidenciales.",
      )],
      ["Datos y privacidad", p(
        "Usamos los datos de su empresa y la información de contacto de su personal solo para prestar los servicios, facturarle y mejorar el servicio, como se describe en nuestra Política de Privacidad. Nunca los vendemos.",
        "Respecto a la información personal que nos dé sobre sus clientes, inquilinos, pacientes o personal, actuamos en su nombre como proveedor de servicios (un \"encargado del tratamiento\"), usándola solo para prestar los servicios y siguiendo sus instrucciones razonables por escrito.",
        "Protegemos los datos con cifrado en tránsito, acceso según funciones y almacenamiento privado, y le avisaremos sin demora injustificada si nos enteramos de un incidente de seguridad que afecte sus datos.",
        "Información médica protegida (PHI) según HIPAA: solo recibiremos, transportaremos o manejaremos PHI después de que ambas partes firmen nuestro Acuerdo de Socio Comercial (BAA) de HIPAA. Hasta que se firme un BAA, por favor no nos envíe PHI. Si se firma un BAA, este prevalece para la PHI y sobre este Acuerdo cuando sean distintos." + COUNSEL,
      )],
      ["No contratación de profesionales", p(
        `Durante este Acuerdo y durante 12 meses después del último servicio que un profesional le preste a través de ${BRAND.name}, usted se compromete a no emplear, contratar ni trabajar directamente con ese profesional (ni con su empresa) para el mismo tipo de servicios fuera de nuestra plataforma.`,
        "Si quiere incorporar a un profesional a su personal o trabajar con él directamente, avísenos. Puede hacerlo pagando un cargo por conversión igual al mayor de $2,500 o el 25% de lo que nos pagó por los servicios de ese profesional en los 12 meses anteriores. Este cargo es una estimación justa de nuestros costos de reclutamiento, verificación y colocación, no una penalidad." + COUNSEL,
        "Esto no impide que un profesional responda a una oferta de empleo general que no esté dirigida a nuestros profesionales.",
      )],
      ["Niveles de servicio y soluciones", p(
        "Los niveles de servicio de un Pedido (como horarios de llegada, tiempos de respuesta, frecuencia o estándares de limpieza) son metas que nos esforzamos por cumplir.",
        `Si no cumplimos un nivel de servicio o el trabajo no cumple con el Pedido, infórmenos dentro de ${BRAND.guaranteeDays} días (antes para servicios diarios, dentro de 48 horas). Su solución es que repitamos el trabajo sin costo o, si repetirlo no es práctico, que le demos un crédito o reembolso del cargo de la visita afectada. Si incumplimos repetidamente el mismo nivel de servicio (3 veces en 60 días), usted puede terminar ese Pedido sin cargo por terminación.`,
        "Estas son sus únicas soluciones por niveles de servicio incumplidos, pero no limitan los reclamos por daños a la propiedad o lesiones.",
      )],
      ["Sus responsabilidades", p(
        ul(
          "Dar acceso seguro durante el horario acordado, con servicios públicos (agua, electricidad) funcionando cuando se necesiten.",
          "Informarnos por escrito sobre peligros conocidos: productos químicos, asbesto, moho, objetos punzocortantes, materiales biológicos peligrosos, animales agresivos, estructuras inseguras y cualquier otra cosa que un profesional deba saber.",
          "Dar información precisa del sitio (metros o pies cuadrados, número de unidades, tamaño del terreno).",
          "Cumplir las leyes que se aplican a sus instalaciones.",
          "Obtener las aprobaciones del arrendador o propietario que necesitemos.",
        ),
      )],
      ["Límites de responsabilidad", p(
        "En la medida en que la ley lo permita, ninguna de las partes es responsable ante la otra por daños indirectos, especiales, incidentales, consecuentes o punitivos, ni por pérdida de ganancias, ingresos o negocios, aunque se le haya advertido que eran posibles.",
        "En la medida en que la ley lo permita, la responsabilidad total de cada parte bajo este Acuerdo se limita a los cargos que usted nos pagó bajo este Acuerdo en los 12 meses anteriores al hecho que dio origen al reclamo, más, en el caso de nuestra responsabilidad, cualquier monto recuperado del seguro de un profesional por ese reclamo.",
        "Estos límites no se aplican a: sus obligaciones de pago; las obligaciones de indemnización de cualquiera de las partes por reclamos de terceros por lesiones corporales o daños a la propiedad; el incumplimiento de la confidencialidad; la negligencia grave, el fraude o la conducta dolosa; ni a cualquier otra cosa que la ley no permita limitar." + COUNSEL,
      )],
      ["Indemnizaciones", p(
        "Lo defenderemos y cubriremos frente a reclamos de terceros por lesiones corporales o daños a la propiedad en la medida en que hayan sido causados por la negligencia o conducta dolosa nuestra o de un profesional que enviamos, mientras prestaba los servicios, o por nuestro incumplimiento de este Acuerdo. Podemos gestionar esos reclamos primero a través del seguro del profesional.",
        "Usted nos defenderá y cubrirá a nosotros y a nuestros profesionales frente a reclamos de terceros en la medida en que hayan sido causados por: peligros en sus instalaciones que usted conocía y no nos informó; instrucciones suyas que seguimos; la negligencia o conducta dolosa suya o de su personal; su incumplimiento de la ley; o su incumplimiento de este Acuerdo.",
        "La obligación de cada parte se reduce en proporción a la parte de culpa de la otra. La parte que pide protección debe avisar a la otra con prontitud, permitirle controlar la defensa y el acuerdo (un acuerdo no puede admitir culpa de la parte protegida sin su consentimiento) y cooperar razonablemente." + COUNSEL,
      )],
      ["Seguros que tenemos y exigimos", p(
        `Exigimos que los profesionales mantengan los seguros indicados arriba en "Nuestros profesionales: verificación y seguro" mientras trabajen en trabajos de ${BRAND.name}, y dejamos de enviar ofertas a cualquier profesional cuya cobertura venza. Mantenemos nuestro propio seguro empresarial en montos que consideramos razonables para nuestro negocio y lo describiremos a solicitud.`,
        "Usted mantiene un seguro de propiedad para sus instalaciones y su contenido.",
      )],
      ["Vigencia y terminación", p(
        "Este Acuerdo comienza cuando usted lo acepta o firma el primer Pedido y continúa hasta que se termine. Cada Pedido tiene la vigencia que indica o, si no indica ninguna, continúa mes a mes.",
        ul(
          "Cualquiera de las partes puede terminar este Acuerdo o cualquier Pedido por cualquier motivo con 30 días de aviso por escrito.",
          "Cualquiera de las partes puede terminarlo de inmediato mediante aviso por escrito si la otra parte lo incumple de manera importante y no corrige el incumplimiento dentro de los 10 días siguientes al aviso (5 días por falta de pago), o si se declara insolvente.",
          "Podemos suspender el servicio de inmediato por razones de seguridad, incluidas amenazas o acoso hacia un profesional.",
        ),
        "Al terminar: usted paga el trabajo realizado y los costos no cancelables en que incurrimos por usted (como depósitos a proveedores y materiales pedidos); nosotros reembolsamos los montos pagados por adelantado por trabajo no realizado; le devolvemos sus llaves, credenciales y materiales dentro de 10 días hábiles y eliminamos los códigos de acceso. Las secciones que por su naturaleza deben seguir vigentes (pago, confidencialidad, no contratación, límites de responsabilidad, indemnizaciones, ley aplicable) siguen vigentes.",
      )],
      ["Ley aplicable, jurisdicción y disputas", p(
        "Este Acuerdo se rige por la ley de Michigan. Cualquier demanda debe presentarse en los tribunales estatales o federales del condado de Wayne (Wayne County), Michigan, y ambas partes aceptan la competencia de esos tribunales.",
        "Antes de demandar, cada parte dará aviso por escrito a la otra y personas de alto nivel de ambas partes se reunirán (en persona o por video) dentro de 30 días para intentar resolverlo. Aun así, cualquiera de las partes puede acudir antes a los tribunales para obtener una medida urgente (como proteger información confidencial o detener el mal uso de llaves o códigos).",
        "Por qué aquí no hay arbitraje: el arbitraje individual para consumidores de nuestros Términos de Uso está pensado para clientes individuales. Para las empresas, un tribunal en nuestro condado es más sencillo, más económico para ambas partes en la mayoría de las disputas, y da a cada parte el derecho de apelar. Las partes aún pueden acordar por escrito someter una disputa específica a arbitraje o mediación.",
        "Ambas partes renuncian al derecho a un juicio con jurado para cualquier disputa bajo este Acuerdo, en la medida en que la ley lo permita." + COUNSEL,
      )],
      ["Orden de prioridad", p(
        "Si los documentos se contradicen, se aplica este orden, del primero al último: (1) un BAA de HIPAA firmado, solo para PHI; (2) el Pedido, pero solo para el término específico que dice modificar; (3) este Acuerdo; (4) el anexo de servicio; (5) el Acuerdo de Servicio para clientes; (6) los Términos de Uso. Los términos de las órdenes de compra que usted nos envíe no se aplican, aunque aceptemos la orden de compra, a menos que los firmemos.",
      )],
      ["Disposiciones generales", p(
        ul(
          "Partes independientes: nada de lo aquí dispuesto crea una sociedad, empresa conjunta, relación laboral ni de representación entre nosotros.",
          "Cesión: ninguna de las partes puede ceder este Acuerdo sin consentimiento, excepto a una empresa que asuma su negocio, con aviso.",
          "Fuerza mayor: ninguna de las partes es responsable por retrasos causados por hechos fuera de su control razonable (clima severo, interrupciones de servicio, emergencias públicas, órdenes del gobierno). Las obligaciones de pago por el trabajo realizado siguen vigentes.",
          "Avisos: por escrito, por correo electrónico a las direcciones de la cuenta y del Pedido (la nuestra: " + BRAND.supportEmail + "), con efecto al enviarse, salvo que el correo sea rechazado.",
          "Acuerdo completo: este Acuerdo y sus Pedidos constituyen el acuerdo completo para servicios empresariales y reemplazan propuestas anteriores. Los cambios deben hacerse por escrito y ser aceptados por ambas partes (un Pedido aceptado en la aplicación cuenta).",
          "Divisibilidad y renuncia: una parte que no se pueda hacer cumplir se modifica solo lo necesario; no hacer cumplir un término no constituye una renuncia.",
          "Firmas electrónicas: aceptar en la aplicación o mediante firma electrónica es obligatorio.",
          "Publicidad: no usaremos su nombre ni su logotipo en publicidad sin su permiso por escrito.",
        ),
      )],
    ]),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PLUS MEMBERSHIP, GIFT CARDS, PROMOS, REFERRALS, TIPS
  // ══════════════════════════════════════════════════════════════════════════
  "plus-gift-cards-promos": {
    title: `${HANDLED_PLUS.name}, Tarjetas de Regalo, Códigos Promocionales y Referidos`,
    appliesTo: `Cualquier persona que se una a ${HANDLED_PLUS.name}, compre o use una tarjeta de regalo, use un código promocional, recomiende a un amigo o dé propina a un profesional.`,
    summary: [
      `${HANDLED_PLUS.name} cuesta ${money(HANDLED_PLUS.monthly)} al mes y se renueva automáticamente cada mes hasta que usted cancele.`,
      "Cancele cuando quiera en línea, con un par de clics. Sus beneficios duran hasta el final del mes que pagó.",
      "Las tarjetas de regalo no vencen durante al menos 5 años y no tienen cargos por inactividad. Trátelas como dinero en efectivo.",
      "Un código promocional por reserva, a menos que el código indique otra cosa. Los códigos no tienen valor en efectivo.",
      "Algunos descuentos tienen un tope para que nunca se reduzca el pago del profesional.",
      `Recomiende a un amigo: él recibe ${money(REFERRAL.friendOff)} de descuento en su primer trabajo y usted recibe ${money(REFERRAL.reward)} de crédito cuando se complete.`,
      "Las propinas son opcionales, y el 100% es para su profesional.",
    ],
    sections: numbered([
      [`${HANDLED_PLUS.name}: lo que recibe`, p(
        `${HANDLED_PLUS.name} es una membresía pagada. Mientras su membresía esté activa, usted recibe:`,
        ul(...HANDLED_PLUS.perks.map((perk) => t("es", perk))),
        `El descuento de miembro del ${pct(HANDLED_PLUS.discountPct)} se aplica al precio del trabajo después de cualquier descuento del plan. Al igual que otros descuentos, puede limitarse en algunos trabajos para que nunca se reduzca el pago del profesional (vea "Códigos promocionales" más abajo). Tener prioridad en horarios del mismo día significa que a los miembros se les ofrecen primero los horarios disponibles del mismo día; no garantiza un horario. El descuento de miembro no se aplica al cargo de reserva de ${FEE} incluido en cada reserva.`,
        "Podemos cambiar o agregar beneficios. Si reducimos los beneficios o subimos el precio, se lo informaremos al menos 30 días antes de su próxima renovación, y usted puede cancelar antes de que se aplique.",
      )],
      [`${HANDLED_PLUS.name}: renovación automática`, p(
        `RENOVACIÓN AUTOMÁTICA: Al unirse, usted nos autoriza a cobrar ${money(HANDLED_PLUS.monthly)} al mes (más cualquier impuesto) a su método de pago, a partir del día en que se une y luego cada mes en la misma fecha, hasta que cancele. La membresía se renueva automáticamente cada mes. El precio, la fecha de renovación y cómo cancelar se muestran antes de unirse y en su correo electrónico de bienvenida.` + COUNSEL,
        "Si un cobro de renovación no se puede procesar, lo intentaremos de nuevo y se lo informaremos. Si aun así no se puede cobrar, su membresía termina y los beneficios de miembro se suspenden.",
      )],
      [`${HANDLED_PLUS.name}: cancelación`, p(
        "Puede cancelar en cualquier momento, en línea, con unos pocos clics: vaya a su cuenta y elija \"Administrar membresía\". Esto abre nuestro portal de facturación seguro, donde puede cancelar de inmediato. También puede cancelar comunicándose con nosotros. Nunca necesita llamar para cancelar.",
        "Cuando cancela, no se le volverá a cobrar. Sus beneficios continúan hasta el final del mes que ya pagó y luego terminan.",
        "No damos reembolsos parciales por partes no usadas de un mes, excepto cuando la ley lo exija. Si se le cobró por error (por ejemplo, después de cancelar), se lo reembolsaremos.",
        "Los descuentos ya aplicados a trabajos reservados mientras era miembro se mantienen. Las visitas de planes recurrentes cobradas después de que termine su membresía se cobran sin el descuento de miembro.",
      )],
      ["Tarjetas de regalo", p(
        ul(
          "Las tarjetas de regalo se pueden usar para cualquiera de nuestros servicios. Ingrese el código al pagar.",
          "Sin vencimiento: las tarjetas de regalo no vencen durante al menos 5 años desde la fecha de compra. No planeamos que venzan nunca.",
          "Sin cargos: nunca cobramos cargos por inactividad, por falta de uso ni por servicio en las tarjetas de regalo.",
          "Úsela en varias reservas: si su reserva cuesta menos que el saldo, el resto queda en la tarjeta para la próxima vez. Si cuesta más, usted paga la diferencia.",
          "No es efectivo: las tarjetas de regalo no se pueden canjear por dinero en efectivo, excepto cuando la ley lo exija (si la ley exige devolver en efectivo saldos pequeños, lo cumpliremos).",
          "Las tarjetas de regalo son dinero prepagado, no un descuento. No reducen el pago del profesional.",
          "Los reembolsos de una reserva pagada con tarjeta de regalo vuelven al saldo de la tarjeta de regalo.",
          "Trátela como dinero en efectivo: si un código se pierde, es robado o se usa sin su permiso, no podemos reemplazarlo, a menos que se haya enviado a un correo electrónico de una cuenta y podamos verificar que no se ha usado. Intentaremos ayudarle.",
          "Podemos cancelar tarjetas de regalo compradas con un medio de pago robado o mediante fraude.",
          "Las tarjetas de regalo no se pueden revender ni usar para comprar otras tarjetas de regalo.",
        ),
        "La ley de Michigan protege a los titulares de tarjetas de regalo, y estos términos buscan darle al menos esa protección." + COUNSEL,
      )],
      ["Códigos promocionales", p(
        ul(
          "Un código promocional por reserva, a menos que el código indique que se puede combinar.",
          "Los códigos pueden tener límites, que mostramos: solo el primer trabajo, pedido mínimo, un servicio determinado, una fecha de vencimiento o un número fijo de usos.",
          "Los códigos no tienen valor en efectivo, no se pueden vender ni intercambiar, y no se pueden aplicar a una reserva que ya pagó.",
          `Algunos descuentos tienen un tope para que nunca se reduzca el pago del profesional. Los descuentos salen de nuestra parte, no de la del profesional. En cada trabajo, conservamos al menos el ${pct(DISCOUNT_FLOOR)} del precio después de pagar al profesional, por lo que un descuento grande puede reducirse en algunos trabajos. La aplicación muestra el descuento que realmente recibe antes de que pague.`,
          `Las propinas, los impuestos, el cargo de reserva de ${FEE} y las compras de tarjetas de regalo no reciben descuentos promocionales.`,
          "Si cancela o recibe un reembolso, le reembolsamos lo que realmente pagó. Los códigos de un solo uso pueden restablecerse a nuestra discreción.",
          "Podemos terminar o cambiar una promoción en cualquier momento, pero no para reservas ya pagadas.",
        ),
      )],
      ["Programa de referidos", p(
        `Comparta su código de referido. Cuando un amigo lo use, recibirá ${money(REFERRAL.friendOff)} de descuento en su primer trabajo. Cuando su primer trabajo se complete y se pague, usted recibirá un crédito de ${money(REFERRAL.reward)} para su próxima reserva.`,
        ul(
          `Puede ganar hasta ${REFERRAL.maxRewardsPerYear} recompensas por referidos por año calendario.`,
          "Su amigo debe ser un cliente nuevo, y el código de referido debe usarse en su primera reserva.",
          "Sin autorreferidos: no puede recomendarse a sí mismo, a otras cuentas suyas ni a personas de su hogar.",
          "Sin spam: no comparta su código con personas que no conoce mediante spam, anuncios en buscadores que usen nuestro nombre o sitios de cupones.",
          "Los créditos funcionan como el saldo de una tarjeta de regalo en su cuenta. No tienen valor en efectivo y no se pueden transferir.",
          "Si detectamos fraude o abuso, podemos cancelar el crédito, el descuento del amigo o el código, y cobrar los créditos ya usados.",
          "Podemos cambiar o terminar el programa con aviso previo. Las recompensas ya ganadas siguen siendo válidas.",
        ),
      )],
      ["Propinas", p(
        `Las propinas son siempre opcionales. Puede dar propina en la aplicación después de completado el trabajo. El 100% de cada propina es para su profesional; nosotros no nos quedamos con nada. Puede dar hasta ${money(TIP_MAX)} de propina por trabajo en la aplicación.`,
        "Una propina no cambia su garantía, y no dar propina nunca afecta su servicio. Las propinas no son reembolsables una vez pagadas al profesional, excepto en caso de errores o fraude.",
      )],
      ["Fraude y cambios", p(
        "Podemos rechazar, cancelar o revertir cualquier membresía, tarjeta de regalo, código promocional, crédito o recompensa obtenidos mediante fraude, abuso, error o en violación de estos términos.",
        "Podemos actualizar estos términos con aviso previo. Los cambios no reducen los saldos de tarjetas de regalo ni las recompensas ya ganadas.",
        "Nuestros Términos de Uso (incluida la resolución de disputas) también se aplican.",
      )],
    ]),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SERVICE ADDENDA
  // ══════════════════════════════════════════════════════════════════════════
  "addendum-transportation": {
    title: "Anexo — Viajes y Transporte",
    appliesTo: "Conductores privados, autos ejecutivos, traslados al aeropuerto, limusinas, autobuses de fiesta, autobuses de alquiler y de turismo, viajes a partidos y conciertos, y transporte para eventos.",
    summary: [
      "Reservamos para usted un transportista de pasajeros con licencia y seguro. El transportista y su conductor realizan el viaje.",
      "El conductor está a cargo de la seguridad y puede rechazar conductas inseguras o ilegales.",
      "Nada de alcohol para menores de 21 años. Se aplican las reglas del transportista sobre el alcohol.",
      "No exceda el número de asientos del vehículo.",
      "Se cobran el tiempo de espera adicional y la limpieza o los daños (como vómito).",
      "El tráfico y las multitudes de eventos pueden causar retrasos que no podemos controlar.",
    ],
    sections: numbered([
      ["Cómo funcionan los viajes", p(
        ADDENDUM_INTRO,
        "El transporte lo prestan empresas de transporte de pasajeros con licencia y seguro (\"transportista\"). Reservamos el transportista por usted, como su agente. El transportista tiene la autorización requerida (por ejemplo, autorización del Departamento de Transporte de Michigan (MDOT) para limusinas y autobuses, y autorización federal de la FMCSA para viajes entre estados) y tiene seguro de transportista de pasajeros.",
        "El transportista es responsable de operar el vehículo, de su conductor y de su seguridad. Nosotros somos responsables de la reserva, el pago, la atención al cliente y nuestra garantía sobre la reserva en sí. Nosotros no conducimos ni operamos vehículos.",
        "El proceso de reclamos por daños de nuestro Acuerdo de Servicio sigue aplicándose: infórmenos los problemas y nosotros trataremos con el transportista y su aseguradora por usted." + COUNSEL,
      )],
      ["Recogida, horarios y espera", p(
        "Indíquenos la dirección exacta de recogida, la hora, las paradas, el número de vuelo (para viajes al aeropuerto) y el número de pasajeros. El precio se basa en estos datos.",
        ul(
          "Viajes al aeropuerto: seguimos su vuelo y ajustamos la recogida si hay retrasos cuando nos da el número de vuelo.",
          "Espera: se incluye un breve período de tolerancia (indicado en su factura). Después, el tiempo de espera se cobra a la tarifa de su factura, en bloques de 15 minutos.",
          "Las paradas adicionales o los cambios de ruta durante el viaje pueden cobrarse a la tarifa de su factura.",
          "Reservas por hora: el tiempo corre desde la recogida hasta la llegada, incluida la espera, y a menudo tiene un mínimo.",
          "Los retrasos causados por el tráfico, el clima, cierres de calles, multitudes de partidos o conciertos, o la policía no son culpa del transportista. Haremos todo lo posible por mantenerle informado.",
        ),
      )],
      ["Pasajeros y conducta", p(
        ul(
          "Nunca más pasajeros que el número de asientos del vehículo. El conductor puede rechazar pasajeros adicionales.",
          "Todos deben usar cinturón de seguridad cuando el vehículo lo tenga.",
          "Niños: la ley de Michigan exige asientos de seguridad o elevadores para niños pequeños. Traiga el suyo, o pídalo al reservar si el transportista los ofrece.",
          "Prohibido fumar o vapear, consumir drogas ilegales, portar armas donde esté prohibido y arrojar objetos desde el vehículo.",
          "Prohibido ir de pie o asomarse por las ventanas o el techo corredizo mientras el vehículo está en movimiento.",
          "El conductor puede terminar el viaje, sin reembolso, si los pasajeros son peligrosos, violentos, abusivos o violan la ley. Aun así podemos cobrar los daños.",
          "La persona que hace la reserva es responsable de la conducta de su grupo.",
        ),
      )],
      ["Alcohol", p(
        "Ninguna persona menor de 21 años puede tener ni beber alcohol a bordo. Si hay alguien menor de 21 años a bordo, el transportista puede prohibir el alcohol durante todo el viaje.",
        "Cuando la ley de Michigan permite que los pasajeros de 21 años o más beban en una limusina o en un vehículo alquilado, las reglas propias del transportista se siguen aplicando. El conductor puede detener el consumo de alcohol o terminar el viaje si alguien está tan intoxicado que representa un peligro. Los conductores nunca beben ni sirven alcohol." + COUNSEL,
      )],
      ["Limpieza y daños", p(
        "Usted es responsable de los daños al vehículo causados por su grupo más allá del uso normal. Se aplican cargos de limpieza por derrames, basura dejada y fluidos corporales (como vómito). El cargo es el costo documentado del transportista, con fotos, hasta el monto indicado en la lista de tarifas del transportista. Le mostraremos las fotos y el cargo antes de cobrarlo a su tarjeta registrada.",
      )],
      ["Objetos perdidos", p(
        "Por favor, revise el vehículo antes de bajarse. Si deja algo, comuníquese con nosotros de inmediato. Le pediremos al transportista que lo busque. No podemos garantizar que se encuentren los objetos. La devolución puede tener un costo adicional.",
      )],
      ["Cancelación", p(
        "Los viajes siguen las reglas de cancelación del Acuerdo de Servicio, excepto que: los vehículos más grandes (limusinas, autobuses de fiesta, autobuses de alquiler y transporte para eventos) a menudo necesitan más aviso. Si los términos de cancelación del transportista son más estrictos, se los mostraremos al reservar, y esos términos se aplican.",
        "Si un transportista cancela o no se presenta, buscaremos otro transportista o le daremos un reembolso completo. En la medida en que la ley lo permita, no somos responsables de vuelos, eventos o conexiones perdidos por retrasos fuera de nuestro control." + COUNSEL,
      )],
    ]),
  },

  "addendum-medical-delivery": {
    title: "Anexo — Entregas Médicas",
    appliesTo: "Recogida de recetas, suministros y equipos médicos, muestras de laboratorio y expedientes médicos transportados por mensajería para pacientes, cuidadores, farmacias, clínicas y laboratorios.",
    summary: [
      "Mensajeros con verificación de antecedentes y capacitación en HIPAA. Firma y registro de cadena de custodia en cada entrega.",
      "Nosotros entregamos. Nunca damos consejos médicos.",
      "Las recetas requieren identificación o firma al entregarlas. Sustancias controladas solo con la aprobación de la farmacia.",
      "Las clínicas, farmacias y laboratorios deben firmar un BAA de HIPAA antes de enviar información de pacientes.",
      "El remitente debe empacar y etiquetar las muestras según las reglas de UN3373/OSHA.",
      "La entrega urgente se hace con el mejor esfuerzo dentro del horario indicado. Nuestra responsabilidad es limitada.",
    ],
    sections: numbered([
      ["Sobre este servicio", p(
        ADDENDUM_INTRO,
        "Nuestros mensajeros tienen verificación de antecedentes y capacitación en HIPAA. Los mensajeros de muestras también tienen capacitación en patógenos transmitidos por la sangre. Cada entrega tiene una firma y un registro de cadena de custodia, con registro de hora y fotos.",
        "Somos solo un servicio de mensajería. No recetamos, no despachamos medicamentos, no damos consejos médicos ni verificamos si un medicamento o artículo es adecuado para usted. Consulte a su médico o farmacéutico.",
      )],
      ["Para pacientes y cuidadores", p(
        ul(
          "Avise a la farmacia que vamos a recoger por usted. La farmacia decide si entrega el artículo.",
          "Las sustancias controladas solo se transportan con la aprobación de la farmacia y de acuerdo con sus procedimientos.",
          "Al entregar, la persona que recibe debe mostrar identificación y/o firmar, según lo exija la farmacia o la ley. Si no hay nadie autorizado, nos comunicaremos con usted y podemos devolver el artículo a la farmacia. Un segundo intento de entrega tiene costo.",
          "Los artículos sensibles a la temperatura (como la insulina o algunas vacunas) se transportan en recipientes con temperatura controlada cuando usted reserva cadena de frío. Por favor, esté disponible para recibirlos a tiempo y guárdelos de inmediato.",
          "El costo de las recetas y los copagos se pagan a la farmacia y no están incluidos en nuestro precio, a menos que acordemos otra cosa.",
          "En una emergencia médica, llame al 911. No dependa de una entrega.",
        ),
      )],
      ["Para clínicas, farmacias y laboratorios", p(
        ul(
          "HIPAA: antes de darnos cualquier información médica protegida (PHI), usted debe firmar nuestro Acuerdo de Socio Comercial (BAA). Hasta entonces, envíe solo lo necesario para la entrega (por ejemplo, un paquete sellado y una dirección), sin diagnóstico ni otros datos de salud.",
          "Empaque: usted es responsable de empacar y etiquetar correctamente las muestras y los artículos médicos (por ejemplo, Sustancia Biológica UN3373, triple empaque de Categoría B y las reglas de OSHA sobre patógenos transmitidos por la sangre) y de seguir sus propios procedimientos. Nuestros mensajeros pueden rechazar un paquete que tenga fugas, esté dañado o no esté bien empacado o etiquetado.",
          "No transportamos sustancias infecciosas de Categoría A, materiales radiactivos ni materiales peligrosos que requieran permisos especiales, a menos que se acuerde por escrito con un transportista calificado.",
          "Cadena de custodia: registramos la recogida, los traspasos y la entrega con hora, firma y fotos, y compartimos el registro con usted.",
          "Tiempos: las recogidas STAT (urgentes) buscan recoger dentro de 90 minutos. Los tiempos de entrega son metas de mejor esfuerzo dentro del horario que confirmamos. El tráfico y el clima pueden causar retrasos. Por favor, planifique los horarios críticos teniendo esto en cuenta.",
          "Las rutas recurrentes y los términos empresariales se rigen por el Acuerdo de Servicios para Empresas y su Pedido.",
        ),
      )],
      ["Responsabilidad por los artículos", p(
        "Si un artículo se pierde o se daña mientras está a cargo de nuestro mensajero, infórmenos dentro de 24 horas. En la medida en que la ley lo permita, nuestra responsabilidad se limita al cargo de entrega más el costo de reemplazo documentado del artículo, hasta $500 por entrega, a menos que se acuerde por escrito un valor mayor antes de la recogida." + COUNSEL,
        "No somos responsables de resultados médicos, muestras echadas a perder ni de la necesidad de tomar una nueva muestra por retrasos fuera de nuestro control, empaque inadecuado o información incorrecta que se nos haya dado. Esto no limita la responsabilidad por nuestra negligencia grave o conducta dolosa.",
      )],
    ]),
  },

  "addendum-pet-care": {
    title: "Anexo — Cuidado de Mascotas",
    appliesTo: "Paseo de perros, cuidado de perros y de mascotas, y recolección de excremento de perro.",
    summary: [
      "Su mascota debe estar vacunada (incluida la vacuna contra la rabia), y usted debe informarnos de cualquier mordida o agresividad.",
      "Siempre con correa en los paseos. Nunca sin correa.",
      "En una emergencia llevamos a su mascota al veterinario. Usted paga las cuentas del veterinario, a menos que nuestro profesional haya causado el problema.",
      "Los profesionales pueden acortar los paseos en clima extremo.",
      "Guardamos sus llaves de forma segura y se las devolvemos cuando las pida.",
    ],
    sections: numbered([
      ["Sus garantías sobre su mascota", p(
        ADDENDUM_INTRO,
        ul(
          "Su mascota tiene al día las vacunas exigidas por la ley (incluida la de la rabia) y tiene licencia donde se exija.",
          "Usted nos ha informado sobre cualquier historial de mordidas, peleas, agresividad, escapes, problemas de salud, alergias y medicamentos.",
          "Su mascota está acostumbrada a un collar o arnés y a una correa que le quede bien.",
          "Usted es el dueño o tiene el permiso del dueño.",
        ),
        "Si su perro muerde o lesiona a alguien, incluido nuestro profesional u otro animal, mientras está a nuestro cuidado, usted es responsable como dueño, según lo establece la ley de Michigan, a menos que la negligencia de nuestro profesional lo haya causado. Por favor, infórmenos sobre cualquier historial de mordidas; si no lo hace, usted es responsable de las lesiones y los costos resultantes." + COUNSEL,
      )],
      ["Paseos y cuidado", p(
        ul(
          "Los perros siempre van con correa fuera de un patio cercado. Nunca soltamos a los perros, ni en parques para perros ni en ningún otro lugar, aunque usted lo pida.",
          "Paseamos juntos solo a los perros de un mismo hogar, a menos que usted acepte paseos en grupo.",
          "Los profesionales pueden acortar u omitir el tiempo al aire libre con calor o frío extremos, hielo o tormentas, y pasar ese tiempo adentro. La visita sigue contando.",
          "Seguimos sus instrucciones de alimentación, medicamentos y cuidado indicadas en la aplicación. Por favor, deje la comida y los suministros a la vista.",
          "Podemos rechazar o suspender el cuidado de un animal agresivo o peligroso. Si suspendemos por ese motivo, se aplican los términos de cancelación tardía.",
        ),
      )],
      ["Emergencias y atención veterinaria", p(
        "Si su mascota se enferma o se lastima, intentaremos comunicarnos con usted y con su contacto de emergencia. Si no podemos comunicarnos rápidamente, usted autoriza a nuestro profesional a llevar a su mascota a su veterinario o a la clínica veterinaria de emergencia más cercana y a aprobar la atención necesaria para estabilizarla, hasta $500, a menos que usted fije otro límite en la aplicación." + COUNSEL,
        "Usted paga las cuentas del veterinario, a menos que el problema haya sido causado por la negligencia de nuestro profesional. En ese caso se aplica nuestro proceso de corrección y de daños.",
      )],
      ["Llaves y acceso a la casa", p(
        "Las llaves, los códigos del garaje y los códigos de cajas de seguridad para llaves se guardan de forma segura y se comparten solo con el profesional de su visita. Avísenos de inmediato si cambia un código. Le devolvemos las llaves cuando las pida o cuando termine su servicio. Si perdemos una llave, pagamos el cambio de la cerradura.",
      )],
      ["Recolección de excremento", p(
        "Para la recolección de excremento en el patio, por favor asegúrese de que las puertas estén sin llave y los perros adentro. Embolsamos y retiramos los desechos. No podemos garantizar que encontremos todo bajo la nieve, en pasto alto o entre plantas densas.",
      )],
    ]),
  },

  "addendum-events": {
    title: "Anexo — Fiestas y Eventos",
    appliesTo: "Planificación de eventos según presupuesto, planificación y coordinación de eventos, catering, food trucks, DJ y música en vivo, alquiler de asientos y artículos para fiestas, y locales para eventos.",
    summary: [
      `Los eventos se reservan con un depósito del ${pct(DEPOSIT.eventShare)}. El saldo se cobra ${DEPOSIT.eventBalanceDaysBefore} días antes del evento.`,
      `El número final de invitados debe confirmarse ${DEPOSIT.eventBalanceDaysBefore} días antes. Después de eso, puede aumentar (si es posible), pero no se reembolsa si hay menos invitados.`,
      "Si un proveedor no puede asistir, lo reemplazamos con uno de igual calidad.",
      "Solo proveedores con licencia sirven alcohol.",
      "Usted sigue las reglas del local y es responsable de los daños a los artículos alquilados.",
      "Mientras más cerca del evento cancele, mayor es la parte del precio que no se reembolsa.",
    ],
    sections: numbered([
      ["Depósitos y saldo", p(
        ADDENDUM_INTRO,
        `Los eventos se reservan con un depósito del ${pct(DEPOSIT.eventShare)} del precio (al menos ${money(DEPOSIT.minimum)}). El saldo se cobra a su tarjeta guardada ${DEPOSIT.eventBalanceDaysBefore} días antes del evento. Los eventos reservados con menos de ${DEPOSIT.eventBalanceDaysBefore} días de anticipación se pagan en su totalidad.`,
        "Muchos proveedores necesitan aviso previo. Algunos eventos no se pueden reservar con poca anticipación; la aplicación muestra el aviso mínimo para cada servicio.",
      )],
      ["Número de invitados y cambios", p(
        ul(
          `El número final de invitados debe confirmarse cuando se cobra el saldo (${DEPOSIT.eventBalanceDaysBefore} días antes). Usted paga por el número final o por el número real, si es mayor.`,
          "Los aumentos después de esa fecha dependen de la disponibilidad y se cobran a la tarifa por invitado.",
          "Las reducciones después de esa fecha no se reembolsan, porque la comida, el personal y los alquileres ya están pedidos.",
          "Los cambios de menú, horario o lugar pueden cambiar el precio. Le enviaremos una orden de cambio para que la apruebe.",
        ),
      )],
      ["Proveedores y sustituciones", p(
        "Reservamos proveedores (servicios de catering, food trucks, DJ, empresas de alquiler y locales) por usted. Si un proveedor no puede cumplir, lo reemplazaremos con uno de igual o mejor calidad y estilo similar, sin costo adicional. Si no podemos, le reembolsamos la parte del precio correspondiente a ese proveedor.",
        "Los platillos del menú pueden sustituirse por otros equivalentes si un ingrediente no está disponible.",
        "Seguridad alimentaria: los servicios de catering y los food trucks tienen las licencias de alimentos requeridas. Por favor, infórmenos con anticipación sobre alergias alimentarias. No podemos garantizar que la comida esté libre de alérgenos, a menos que el proveedor de catering lo confirme por escrito. La comida sobrante se maneja según las normas sanitarias; es posible que no podamos dejársela.",
      )],
      ["Alcohol", p(
        "El alcohol solo lo sirven proveedores que tienen la licencia correspondiente de la Comisión de Control de Licores de Michigan (Michigan Liquor Control Commission) y seguro de responsabilidad por venta de alcohol. Los meseros pueden pedir identificación, negarse a servir a cualquier persona menor de 21 años o visiblemente intoxicada, y suspender el servicio en cualquier momento.",
        "Si usted lleva su propio alcohol donde el local lo permita, usted es responsable de servirlo legalmente y de la conducta de sus invitados." + COUNSEL,
      )],
      ["Locales, permisos y ruido", p(
        ul(
          "Usted y sus invitados deben seguir las reglas del local (horarios, decoraciones, capacidad, limpieza, límites de música).",
          "Si su evento es en un parque, en la calle u otro lugar público, puede necesitarse un permiso. Le avisaremos si sabemos que se necesita y podemos ayudarle a obtenerlo. El costo del permiso aparece en su factura.",
          "Se aplican las normas locales sobre ruido. El DJ puede bajar el volumen o detenerse a la hora exigida.",
          "Los daños al local, la limpieza adicional o el tiempo extra causados por su grupo se cobran al costo documentado del local.",
        ),
      )],
      ["Alquileres", p(
        "Los artículos alquilados (mesas, sillas, carpas, mantelería, equipos) siguen siendo propiedad de la empresa de alquiler. Usted es responsable de la pérdida o los daños más allá del uso normal mientras estén en su poder, al costo documentado de reemplazo o reparación de la empresa de alquiler. Por favor, manténgalos secos y seguros, y téngalos listos a la hora de recogida.",
        "Las carpas y algunos equipos solo se pueden instalar en terreno adecuado y con clima seguro. El equipo de trabajo puede negarse a una instalación insegura.",
      )],
      ["Eventos al aire libre y clima", p(
        "Para eventos al aire libre, por favor planifique una alternativa para lluvia o frío (una carpa, un espacio interior o una fecha alternativa). El clima no es motivo de cancelación gratuita, a menos que las autoridades o el local cierren el evento, o que nuestro equipo no pueda instalar con seguridad (por ejemplo, por rayos o vientos fuertes). En ese caso, trabajaremos con usted para cambiar la fecha, y aún pueden aplicarse los costos no reembolsables de los proveedores.",
      )],
      ["Cancelación", p(
        "Como los proveedores reservan su fecha y piden suministros, los eventos tienen sus propios niveles de cancelación:" + COUNSEL,
        ul(
          "Más de 30 días antes del evento: reembolso completo, menos cualquier costo no reembolsable de proveedores ya pagado por usted (indicado en su factura o cotización).",
          `Entre 30 y ${DEPOSIT.eventBalanceDaysBefore + 1} días antes del evento: el depósito no es reembolsable. No se le cobrará el saldo.`,
          `Dentro de los ${DEPOSIT.eventBalanceDaysBefore} días previos al evento: el precio completo no es reembolsable. Le reembolsaremos cualquier monto que los proveedores nos devuelvan.`,
          "En lugar de cancelar, puede cambiar el evento una vez a una fecha dentro de 12 meses, según la disponibilidad. El dinero pagado se acredita a la nueva fecha; se aplican las diferencias de precio.",
          "Si nosotros cancelamos, o no podemos ofrecer un proveedor de reemplazo, usted recibe un reembolso completo de la parte afectada.",
        ),
      )],
    ]),
  },

  "addendum-construction-remodel": {
    title: "Anexo — Reparaciones, Oficios, Pintura y Remodelaciones",
    appliesTo: "Servicios de mantenimiento general (handyman), plomería, calentadores de agua, calefacción y aire acondicionado (HVAC), iluminación y ventiladores de techo, cámaras de seguridad, trituradores de basura, pintura interior y exterior, y remodelación de baños, cocinas y casas completas.",
    summary: [
      "El trabajo que requiere licencia (plomería, electricidad, HVAC, pintura, remodelaciones) lo hacen solo contratistas con licencia.",
      "El contratista tramita los permisos necesarios. El costo aparece en su factura.",
      "Los proyectos más grandes se pagan por etapas (hitos). Los cambios se aprueban y se pagan en la aplicación antes del trabajo adicional.",
      "Los problemas ocultos detrás de paredes o pisos se cotizan como una orden de cambio.",
      "Recibe una garantía de mano de obra de 1 año en remodelaciones y trabajos de oficios con licencia, además de nuestra garantía de 30 días.",
      "Tiene 3 días hábiles para cancelar un contrato firmado en su casa después de una visita al sitio.",
    ],
    sections: numbered([
      ["Quién hace el trabajo", p(
        ADDENDUM_INTRO,
        "El trabajo que legalmente requiere licencia (plomería, electricidad, HVAC, contratación de pintura, remodelación y construcción residencial) lo hace solo un contratista con la licencia de Michigan correspondiente. El trabajo sencillo de mantenimiento general lo hacen profesionales asegurados, dentro de lo que la ley de Michigan permite sin licencia.",
        `${BRAND.legalName} administra y garantiza el trabajo. Cuando la ley exige que el contratista con licencia contrate directamente con usted, el contratista con licencia es el contratista responsable, y nosotros actuamos como su administrador del proyecto y agente de pago.` + COUNSEL,
      )],
      ["Permisos e inspecciones", p(
        "Si se requiere un permiso, el contratista con licencia lo tramita a su nombre y programa las inspecciones. El costo del permiso aparece en su factura. Usted se compromete a dar acceso a los inspectores. El trabajo que no pase la inspección se corrige sin costo para usted, a menos que la falla se deba a una condición fuera del alcance.",
        "No hacemos trabajos que requieren permiso sin un permiso, aunque usted lo pida.",
      )],
      ["Calendario de pagos", p(
        "Los trabajos más pequeños se pagan por adelantado. Los proyectos más grandes se pagan por etapas, como se indica en su cotización. Por ejemplo: un depósito para programar y pedir materiales, un pago en una etapa determinada (como la instalación preliminar o la entrega de gabinetes), y el pago final cuando el trabajo esté terminado y haya pasado nuestro control de calidad y cualquier inspección final.",
        `Los depósitos siguen el Acuerdo de Servicio (${pct(DEPOSIT.share)}, al menos ${money(DEPOSIT.minimum)}). Nosotros le pagamos al contratista a medida que se completa y revisa cada etapa, nunca más que el trabajo realizado más los materiales entregados.`,
      )],
      ["Órdenes de cambio", p(
        "Cualquier cambio en el trabajo, el precio o el calendario debe hacerse por escrito como una orden de cambio en la aplicación, aprobada por usted y pagada antes de que comience el trabajo adicional. Los acuerdos verbales con el equipo de trabajo no nos obligan ni a usted ni a nosotros. Las órdenes de cambio se cobran según nuestras tarifas estándar.",
      )],
      ["Condiciones ocultas", p(
        "Algunos problemas no se pueden ver hasta que empieza el trabajo, como madera podrida, moho, daños por agua, cableado antiguo, tuberías dañadas, problemas estructurales, asbesto o plomo. Cuando se encuentran, el trabajo en esa área se detiene y le enviamos una orden de cambio para corregirlo. Si la condición oculta es peligrosa (como el asbesto), debe atenderla un especialista con licencia, y no podemos continuar hasta que lo haga.",
      )],
      ["Materiales", p(
        "Los materiales se indican en su cotización. Los materiales de pedido especial (como gabinetes, encimeras, azulejos y accesorios) se piden después de que usted paga el depósito y aprueba sus elecciones. Los pedidos especiales normalmente no se pueden devolver. Si cancela o cambia de opinión después de hacer el pedido, usted paga el costo de los materiales, más cualquier cargo por reposición que cobre el proveedor, menos lo que el proveedor reembolse. Usted se queda con los materiales que haya pagado.",
        "Los retrasos en las entregas de los proveedores pueden mover su calendario. Le mantendremos informado.",
        "Los materiales que usted mismo proporcione deben estar en el sitio y ser los correctos. No están cubiertos por nuestra garantía, y los retrasos que causen pueden tener un costo adicional.",
        "El equipo que usted compre para que lo instalemos (por ejemplo, un calentador de agua en un trabajo de solo instalación) debe ser nuevo y sin usar, en su empaque original, y del tamaño y tipo correctos para su casa. Nuestra garantía de mano de obra de 1 año cubre nuestra instalación; el equipo en sí lo cubre su fabricante o vendedor, no nosotros. No instalamos equipo usado.",
      )],
      ["Gravámenes y renuncias a gravámenes", p(
        "Según la Ley de Gravámenes de Construcción de Michigan (Michigan Construction Lien Act), los contratistas, proveedores y trabajadores a quienes no se les paga pueden tener derecho a imponer un gravamen sobre su propiedad. Para protegerle, en los proyectos donde los gravámenes son posibles, le daremos una declaración jurada con la lista de contratistas y proveedores, y con el pago final le entregamos renuncias a gravámenes del contratista y de los proveedores principales. Por favor, no le pague directamente a ningún contratista ni proveedor." + COUNSEL,
        "Si recibe un aviso de suministro (notice of furnishing) de un proveedor, envíenoslo de inmediato.",
      )],
      ["Garantía", p(
        `Nuestra garantía de corrección de ${BRAND.guaranteeDays} días se aplica a cada trabajo. Además, las remodelaciones y los trabajos de oficios con licencia (plomería, electricidad, HVAC, calentadores de agua y pintura por contratistas con licencia) tienen una garantía de mano de obra de 1 año a partir de su terminación. Si aparece un defecto de mano de obra dentro de ese año, avísenos y lo corregiremos sin costo.`,
        "Las garantías del fabricante sobre productos y equipos (como un calentador de agua o una caldera) pasan a usted. Puede requerirse un registro; le ayudaremos a registrarlos.",
        "La garantía no cubre: materiales que usted proporcionó; el desgaste normal; daños por mal uso, accidentes, fenómenos climáticos o falta de mantenimiento (por ejemplo, no cambiar los filtros del HVAC); asentamientos, pequeñas grietas en paneles de yeso o clavos que sobresalen; cambios hechos por otros; y los elementos indicados como excluidos en la cotización.",
      )],
      ["Su derecho a cancelar en 3 días", p(
        "Si usted acepta el proyecto en su casa después de una visita al sitio, puede cancelar dentro de 3 días hábiles según la Ley de Ventas por Solicitación a Domicilio de Michigan (Michigan Home Solicitation Sales Act), como se explica en el Acuerdo de Servicio. El trabajo y los pedidos de materiales no comenzarán antes de que termine ese plazo, a menos que usted nos pida por escrito una reparación de emergencia." + COUNSEL,
      )],
      ["Trabajo seguro con plomo", p(
        "En las casas construidas antes de 1978, los renovadores certificados aplican las prácticas de trabajo seguro con plomo de la norma RRP de la EPA en trabajos de pintura, remodelación y reparaciones que alteren superficies pintadas. Usted recibirá el folleto \"Renovate Right\" antes de que empiece el trabajo. Las prácticas seguras con plomo pueden agregar tiempo y costo, que se indican en su cotización.",
      )],
      ["Sitio de trabajo, servicios públicos y limpieza", p(
        ul(
          "Es posible que necesitemos cortar el agua, la electricidad o el gas durante parte del trabajo. Le avisaremos antes de hacerlo.",
          "Por favor, mantenga a los niños y a las mascotas fuera del área de trabajo.",
          "El equipo protege los pisos y muebles cercanos al área de trabajo y limpia cada día. Los escombros del trabajo se retiran, a menos que la cotización diga otra cosa.",
          "El polvo y el ruido son normales en la construcción. Tomamos medidas razonables para limitarlos.",
          "El horario de trabajo sigue las normas locales, normalmente de lunes a sábado, durante el día.",
        ),
      )],
      ["Pintura", p(
        "Los precios de pintura incluyen la preparación indicada en la cotización. Los colores se ven distintos en la pared que en las muestras; le recomendamos probar una muestra primero. Volver a pintar por un cambio de color después de que empieza el trabajo es una orden de cambio. La pintura exterior depende de clima seco y de temperaturas por encima del mínimo del fabricante de la pintura, por lo que las fechas pueden cambiar.",
      )],
    ]),
  },

  "addendum-errands-delivery": {
    title: "Anexo — Mandados, Mensajería y Asistente Personal",
    appliesTo: "Mandados, recogidas y compras en tienda, mensajería el mismo día, y un asistente personal por el día.",
    summary: [
      "Compramos cosas por usted al costo, con el recibo. Sin recargo.",
      "Indíquenos sus preferencias de sustitución. Si algo está agotado, las seguimos o lo omitimos.",
      "El alcohol y el tabaco requieren a un adulto con identificación al entregarlos, y pueden rechazarse.",
      "No se entregan recetas mediante mandados. Use Entregas Médicas en su lugar.",
      "Una vez entregados, los productos perecederos son su responsabilidad.",
      "Los profesionales no llevan dinero en efectivo por usted.",
    ],
    sections: numbered([
      ["Compras en su nombre", p(
        ADDENDUM_INTRO,
        `Cuando compramos por usted, adquirimos los artículos en su nombre y le cobramos el costo exacto del recibo de la tienda, sin recargo. Nuestro precio cubre el servicio. El recibo se guarda en la aplicación. Las compras de más de ${MATERIALS_OK} necesitan primero su aprobación, y las compras de mandados tienen un límite de ${SHOPPING_MAX} por reserva, a menos que acordemos un monto mayor.`,
        "Los precios de la tienda, el impuesto sobre las ventas y los depósitos por envases son los que cobra la tienda. Los descuentos de programas de lealtad de la tienda se aplican solo si nos da su número de socio.",
      )],
      ["Sustituciones", p(
        "Indíquenos en la aplicación si podemos sustituir un artículo agotado, y con qué. Si no lo indica, el profesional puede enviarle un mensaje; si no responde pronto, elegirá un artículo parecido (mismo tipo, tamaño y precio similares) u omitirá el artículo. Puede rechazar un sustituto al momento de la entrega, y se lo reembolsaremos o lo devolveremos a la tienda cuando sea posible.",
      )],
      ["Artículos con restricción de edad", p(
        "El alcohol, el tabaco y los productos de vapeo solo se pueden comprar y entregar donde la ley lo permita. Una persona de 21 años o más debe mostrar una identificación válida al momento de la entrega. Si nadie puede hacerlo, o si la persona parece intoxicada, el artículo se devuelve a la tienda y puede aplicarse un cargo por devolución. El profesional puede negarse a comprar estos artículos.",
      )],
      ["Lo que no hacemos", p(
        ul(
          "No se entregan recetas ni sustancias controladas mediante mandados. Use Entregas Médicas, que tiene mensajeros capacitados en HIPAA y procedimientos de farmacia.",
          "No se manejan artículos ilegales, armas, municiones, materiales peligrosos ni animales vivos.",
          "No llevamos ni manejamos dinero en efectivo por usted, ni hacemos depósitos bancarios.",
          "No llevamos ni transportamos personas en el auto del profesional. Use nuestros servicios de viajes.",
          "No damos cuidado personal (como bañar o asistencia médica) ni cuidado de niños.",
          "No firmamos documentos legales ni contratos en su nombre.",
        ),
      )],
      ["Entrega y productos perecederos", p(
        "Entregamos en la dirección que nos indique. Si no hay nadie en casa, dejamos los artículos no perecederos en un lugar seguro que usted elija, con una foto. Los artículos perecederos y congelados se mantienen fríos en la medida de lo posible durante la compra y el traslado. Una vez entregados (en sus manos o dejados como usted pidió), son su responsabilidad. Si los artículos llegan echados a perder o dañados, infórmenos dentro de 24 horas con una foto.",
      )],
      ["Asistente personal", p(
        "Su asistente sigue su lista de tareas, en orden, durante las horas reservadas. Las tareas deben ser legales y seguras y corresponder al servicio. Las horas adicionales son una orden de cambio. Si su asistente maneja para hacer mandados, se incluye el kilometraje hasta el monto indicado en su factura.",
      )],
    ]),
  },

  "addendum-hauling": {
    title: "Anexo — Retiro de Basura, Artículos Grandes, Contenedores, Mudanzas y Entregas",
    appliesTo: "Retiro de basura y objetos no deseados, retiro de artículos grandes, entrega y recogida de contenedores para basura, mudanzas pequeñas, entrega de objetos grandes el mismo día, mudanza de muebles para decoración de casas en venta, y la parte de retiro de una preparación de unidad de renta.",
    summary: [
      "Usted confirma que es dueño de los artículos o que tiene derecho a que se los lleven.",
      "No se aceptan desechos peligrosos: pintura, productos químicos, asbesto, tanques de propano y artículos similares.",
      "Algunos artículos (llantas, colchones, electrodomésticos, aparatos electrónicos) pueden tener cargos por desecho.",
      "Donamos o reciclamos cuando podemos, a nuestra elección.",
      "Los contenedores pueden marcar las entradas de autos. Colocarlos en la calle requiere un permiso de la ciudad.",
      "El peso del contenedor que exceda lo permitido se cobra al costo del relleno sanitario, con el comprobante de pesaje.",
      "Mudanzas y entregas: las mudanzas por hora se cobran por el tiempo real; nuestra responsabilidad por los objetos mudados es limitada, a menos que compre protección adicional.",
    ],
    sections: numbered([
      ["Sus artículos", p(
        ADDENDUM_INTRO,
        "Usted confirma que es dueño de los artículos que se van a retirar o que tiene el permiso del dueño (por ejemplo, un arrendador o una sucesión). Una vez cargados, los artículos pasan a ser nuestros para desecharlos. No podemos devolver artículos después de llevárnoslos. Por favor, retire todo lo que quiera conservar e indíquenos los artículos que debemos dejar.",
        "No revisamos los artículos en busca de objetos de valor. Revise primero cajones, bolsillos y cajas.",
      )],
      ["Artículos que no podemos llevar", p(
        "Por razones de seguridad y legales, no llevamos:",
        ul(
          "Desechos peligrosos: pintura (excepto látex completamente seco), solventes, aceite, gasolina, pesticidas, productos químicos para piscinas, productos químicos de limpieza.",
          "Asbesto, escombros con pintura de plomo provenientes de trabajos de remoción, escombros de remediación de moho, ni desechos médicos u objetos punzocortantes.",
          "Tanques de propano, tanques de combustible, baterías de autos, municiones y explosivos.",
          "Animales muertos, desechos de comida en cantidad, ni excrementos humanos o de animales.",
        ),
        "Algunos artículos se aceptan solo con un cargo adicional por desecho que se muestra antes de pagar: llantas, colchones y bases de cama, electrodomésticos con refrigerante (refrigeradores, congeladores, unidades de aire acondicionado), televisores y aparatos electrónicos. Si encontramos artículos prohibidos, los dejaremos.",
      )],
      ["Desecho, donación y reciclaje", p(
        "Llevamos los artículos a instalaciones autorizadas de desecho, reciclaje o donación. Donamos o reciclamos cuando los artículos están en buen estado y una instalación los acepta, a nuestra elección. No podemos garantizar que se done ningún artículo, y no podemos dar recibos de donación para impuestos, a menos que la organización benéfica los proporcione.",
      )],
      ["Contenedores (contenedor para basura)", p(
        ul(
          "Ubicación: usted elige un lugar plano y firme con acceso libre. Usamos tablas de protección para la entrada de autos, pero los contenedores y los camiones son pesados y pueden rayar, agrietar o marcar entradas de autos, céspedes y bordillos. No somos responsables de esto, a menos que lo cause la negligencia de nuestro conductor." + COUNSEL,
          "Colocarlo en la calle requiere un permiso de la ciudad. Si elige colocarlo en la calle, nosotros tramitamos el permiso y el costo aparece en su factura.",
          "No lo llene de más: nada por encima del borde superior. Podemos retirar el material sobrante antes de la recogida, con un cargo.",
          "Peso: su precio incluye un peso permitido. El peso que exceda lo permitido se cobra al costo por tonelada del relleno sanitario, con el comprobante de pesaje.",
          "Los contenedores para escombros pesados (concreto, ladrillo, tierra) son solo para ese material. Las cargas mixtas pueden cobrarse como escombros comunes, más cualquier cargo adicional del relleno sanitario.",
          "Los días adicionales se cobran a la tarifa de su factura.",
          "Si no podemos recogerlo porque el contenedor está bloqueado o sobrecargado, se aplica un cargo por visita fallida.",
          "Usted es responsable de lo que se ponga en el contenedor, incluso si lo ponen vecinos u otras personas.",
        ),
      )],
      ["Carga y acceso", p(
        "Nuestro equipo carga desde donde usted nos indique. Los traslados largos, las escaleras y el desarmado se cotizan en su presupuesto. Tenemos cuidado, pero mover artículos pesados por espacios estrechos puede causar pequeñas marcas en paredes o pisos. Por favor, indíquenos las áreas frágiles. Los daños causados por negligencia se manejan según el Acuerdo de Servicio.",
      )],
      ["Mudanzas y entregas", p(
        ul(
          "Mudanzas por hora: su cotización muestra las horas estimadas. Usted paga el tiempo real, desde que llega el equipo hasta que se coloca el último objeto, en intervalos de media hora, con el mínimo indicado en su cotización. Si la mudanza va a tardar más de lo estimado, el jefe del equipo se lo avisa en la aplicación antes de pasarse.",
          "Empaque y preparación: las cajas deben estar empacadas y cerradas, a menos que haya reservado el empaque. No mudamos dinero en efectivo, joyas, documentos importantes, medicamentos, armas de fuego, mascotas, plantas que no sobrevivan el viaje, alimentos perecederos ni artículos peligrosos. Mantenga sus objetos de valor con usted.",
          "Protección de sus objetos: a menos que compre protección adicional, nuestra responsabilidad por pérdida o daño de los objetos mudados o entregados se limita a $0.60 por libra por objeto. Los objetos que usted empacó solo están cubiertos por daños que causamos al manejarlos con descuido. Reporte los daños dentro de 7 días, con fotos." + COUNSEL,
          "Entregas para tiendas y vendedores: entregamos lo que recogemos, en su empaque; no lo abrimos ni lo revisamos en busca de defectos, no conectamos gas, agua ni electricidad, ni instalamos nada más allá del armado básico. El comprobante de entrega es una foto en el lugar de entrega.",
          "Muebles de decoración: el decorador o el agente es nuestro cliente en ambos viajes. La recogida se programa cuando nos avise que la propiedad se vendió; si los muebles no están listos o no hay acceso a la hora reservada, se aplica un cargo por visita.",
          "Las mudanzas son locales, dentro de Michigan, y se cobran como mano de obra y transporte local." + COUNSEL,
        ),
      )],
    ]),
  },

  "addendum-vehicle-detailing": {
    title: "Anexo — Detallado Móvil de Autos",
    appliesTo: "Detallado móvil de autos en su casa o negocio.",
    summary: [
      "El profesional fotografía los daños existentes antes de empezar.",
      "Retire los objetos de valor y las pertenencias personales antes de su cita.",
      "Es posible que necesitemos agua y electricidad, a menos que el profesional traiga las suyas.",
      "Algunos rayones, manchas y olores no se pueden eliminar por completo.",
    ],
    sections: numbered([
      ["Antes de empezar", p(
        ADDENDUM_INTRO,
        "El profesional recorre su vehículo y toma fotos de los rayones, abolladuras, desportilladuras, manchas y desgaste existentes antes de empezar. No somos responsables de daños que ya existían.",
        "Por favor, retire los objetos de valor, el dinero en efectivo, los asientos para niños y las pertenencias personales. No somos responsables de los objetos que deje en el vehículo.",
        "Usted confirma que es dueño del vehículo o que tiene permiso, y que está estacionado donde se permite el detallado (la entrada de su casa o un estacionamiento cuyo dueño lo permita).",
      )],
      ["Agua y electricidad", p(
        "El profesional puede necesitar acceso a una llave de agua exterior y a un tomacorriente, a menos que traiga los suyos. Avísenos si no hay ninguno disponible. El detallado puede reprogramarse por lluvia, temperaturas bajo cero o calor extremo.",
      )],
      ["Resultados", p(
        ul(
          "La corrección de pintura mejora el aspecto de la pintura. No puede eliminar rayones que atraviesan la capa transparente, desportilladuras por piedras ni óxido.",
          "Las manchas y los olores del interior (humo, mascotas, derrames) a menudo se pueden reducir, pero no siempre eliminar por completo.",
          "Las molduras, la tapicería, el cuero y los vinilos viejos o dañados pueden ser más frágiles. El profesional le advertirá de cualquier cosa que pueda ser riesgosa.",
          "Las ceras y los recubrimientos duran distintos períodos según el clima y el cuidado.",
        ),
        "Los límites estéticos que le explicamos antes del trabajo no están cubiertos por la garantía. Cualquier cosa que hayamos pasado por alto sí está cubierta.",
      )],
    ]),
  },

  "addendum-home-and-yard": {
    title: "Anexo — Limpieza, Hogar y Jardín",
    appliesTo: "Limpieza, ventanas, alfombras y tapicería, organización, canaletas, lavado a presión, cuidado del césped, retiro de hojas, remoción de nieve, y tala y poda de árboles.",
    summary: [
      "Los profesionales solo trabajan a alturas que pueden alcanzar con seguridad, con escaleras adecuadas.",
      "Nieve: con un plan de temporada, limpiamos después de 2 pulgadas o más. Por favor, marque los bordillos, los canteros y los bordes; no podemos ser responsables de objetos no marcados bajo la nieve.",
      "El lavado a presión puede desprender pintura o revestimiento exterior viejos y en mal estado.",
      "Algunas alfombras pueden encogerse o desteñirse; hacemos una prueba primero.",
      "Al organizar, usted decide qué se conserva, se dona o se tira.",
      "La tala de árboles la hacen equipos asegurados. Las líneas de servicios públicos las maneja la empresa de servicios.",
    ],
    sections: numbered([
      ["Escaleras y alturas", p(
        ADDENDUM_INTRO,
        "Los profesionales usan escaleras y equipo de seguridad adecuados, y solo trabajan a alturas que pueden alcanzar con seguridad. Las ventanas, canaletas y revestimientos exteriores más altos que nuestro límite indicado (o en techos empinados) pueden necesitar equipo especial y una orden de cambio, o puede que no sea posible hacerlos. Los profesionales pueden omitir áreas que no sea seguro alcanzar y se lo informarán.",
      )],
      ["Limpieza", p(
        ul(
          "Infórmenos sobre superficies delicadas (piedra natural, madera sin sellar, antigüedades) y productos de su preferencia. Nuestros profesionales usan productos estándar, a menos que usted pida otra cosa.",
          "No movemos muebles pesados, no limpiamos materiales biológicos peligrosos (sangre, fluidos corporales más allá de la limpieza doméstica normal, agujas), no tratamos plagas ni limpiamos por encima de una altura segura.",
          "No podemos garantizar la eliminación de manchas antiguas, depósitos de agua dura, corrosión o daños.",
        ),
      )],
      ["Alfombras y tapicería", p(
        "Hacemos pruebas previas en las telas cuando es posible. Algunas alfombras, tapetes y telas pueden encogerse, desteñirse, arrugarse o perder textura al limpiarse, especialmente las viejas, las de fibras naturales o las de mala fabricación. Le informaremos primero de cualquier riesgo que veamos. Algunas manchas (cloro, tintes, orina de mascotas que haya penetrado el acolchado) pueden no salir. Espere el tiempo de secado antes de caminar o sentarse en las áreas limpiadas.",
      )],
      ["Organización y despeje", p(
        "Usted decide qué se conserva, se dona, se recicla o se tira. Nuestro profesional no tirará nada sin su aprobación. Los artículos marcados para donación o desecho se retiran solo si su reserva incluye el retiro. No somos responsables de los artículos que usted nos indicó desechar.",
      )],
      ["Canaletas y lavado a presión", p(
        ul(
          "La limpieza de canaletas retira los residuos y revisa los bajantes. No incluye reparaciones, a menos que se coticen. Podemos encontrar daños; se lo informaremos.",
          "El lavado a presión puede desprender pintura que ya está en mal estado, dañar revestimientos, madera o mortero viejos o quebradizos, y hacer que el agua pase por sellos en mal estado. Por favor, cierre las ventanas e infórmenos de los puntos débiles. Usamos lavado suave a menor presión cuando es adecuado. Los daños a superficies que ya estaban en mal estado no están cubiertos.",
          "Necesitamos una llave de agua exterior. Escurrimiento y plantas: enjuagamos las plantas cercanas, pero las soluciones de limpieza pueden afectar a las plantas sensibles.",
        ),
      )],
      ["Césped y hojas", p(
        "Por favor, retire juguetes, mangueras, excremento de mascotas y residuos del césped antes de cada visita. No somos responsables de objetos ocultos en el pasto alto o entre las hojas, ni de daños a aspersores, cables o cercas invisibles para perros que no estén marcados. Las visitas pueden cambiar por lluvia o terreno mojado. El retiro de hojas cubre las áreas reservadas; las hojas que caigan después de la visita no están incluidas.",
      )],
      ["Remoción de nieve", p(
        ul(
          "Limpieza única: limpiamos una vez, en la fecha y hora que usted reserve. La nieve que caiga después de la visita no está cubierta.",
          "Plan de temporada (prepagado, de noviembre a marzo): su equipo llega automáticamente después de cada nevada de 2 pulgadas o más, hasta el número de tormentas de su plan. Las visitas normalmente se hacen después de que deja de nevar; durante tormentas largas podemos ir más de una vez. Las tormentas adicionales que excedan su plan se cobran por visita a la tarifa de su plan.",
          "Horario: después de tormentas grandes, todos necesitan limpieza al mismo tiempo. Avanzamos por las rutas tan rápido como sea posible con seguridad; no podemos prometer una hora específica.",
          "Marcadores: por favor, coloque estacas o marcadores a lo largo de los bordes de la entrada de autos, los bordillos, los canteros, los caminos y cualquier cosa oculta bajo la nieve antes de la temporada. No somos responsables de daños al césped, bordillos, jardinería, adoquines, bordes u objetos bajo la nieve que no estuvieran marcados. Es normal que se raspe un poco el césped en los bordes de la entrada de autos." + COUNSEL,
          "Sal y descongelante: solo cuando se reserven. El hielo puede volver a formarse cuando la nieve se derrite y se vuelve a congelar; la limpieza no garantiza una superficie libre de hielo. Camine con cuidado. La sal puede dañar el concreto, las plantas y las mascotas; pida un producto seguro para mascotas.",
          "Por favor, mueva los autos del área que se va a limpiar. No podemos limpiar por completo alrededor de autos estacionados.",
          "Las represas de hielo, los techos y la nieve que deje el quitanieves de la ciudad al final de la entrada de autos después de nuestra visita no están incluidos, a menos que se reserven.",
        ),
      )],
      ["Tala y poda de árboles", p(
        ul(
          "La tala y poda de árboles la hacen equipos de arboristas asegurados, y el precio firme se fija después de una visita gratuita al sitio.",
          "Líneas de servicios públicos: no trabajamos dentro de la distancia de las líneas eléctricas que la ley reserva a los trabajadores autorizados de despeje de líneas. Si un árbol toca las líneas, la empresa de servicios (como DTE) primero debe hacerlo seguro.",
          "Triturado de tocones: antes de triturar, el equipo llama a MISS DIG 811 para marcar las líneas subterráneas públicas. Usted debe marcar las líneas privadas (aspersores, cercas invisibles, iluminación, líneas privadas de gas o agua).",
          "Usted confirma que el árbol está en su propiedad o que tiene el permiso por escrito del dueño. Los árboles de los vecinos y las disputas por límites de propiedad son su responsabilidad.",
          "El equipo pesado puede dejar surcos en el césped. Protegemos donde podemos, pero la reparación del césped no está incluida, a menos que se cotice.",
          "La madera y los residuos se retiran, a menos que usted nos pida dejar la madera.",
        ),
      )],
    ]),
  },
};
