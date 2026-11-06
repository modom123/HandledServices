/*
 * FILE    : apps/web/lib/contracts/es-state.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-06_0311 UTC
 * PURPOSE : Spanish translations of the state addenda in state.ts (New York, New Jersey, Nevada), customers and pros.
 *           Same sections in the same order as the English, which controls if they differ. The New Jersey notice of
 *           the right to cancel is also given in English, because the law sets its exact words.
 */
import { BRAND } from "@handled/core";
import type { ContractTranslation } from "./types";

const COUNSEL = " [Confirmar con un abogado.]";
const p = (...paras: string[]) => paras.join("\n\n");
const ul = (...items: string[]) => items.map((i) => `• ${i}`).join("\n");
const numbered = (items: [string, string][]) => items.map(([h, body], i) => ({ h: `${i + 1}. ${h}`, p: body }));
const L = BRAND.legalName;
const N = BRAND.name;
const CONTACT = `${BRAND.supportEmail} o ${BRAND.supportPhone}`;

// Filled from Vercel env so the live text never shows a blank: BUSINESS_POSTAL_ADDRESS (also on the Contact page) and
// NJ_HIC_REGISTRATION (Handled's New Jersey home improvement contractor registration number, once issued).
let ADDRESS = "", NJ_REG = "";
try { ADDRESS = process.env.BUSINESS_POSTAL_ADDRESS?.trim() ?? ""; NJ_REG = process.env.NJ_HIC_REGISTRATION?.trim() ?? ""; } catch { /* no process here */ }

const HOW = (estado: string) => p(
  `Este anexo se suma a nuestros Términos de Uso, al Acuerdo de Servicio y, en las reservas de empresas, al Acuerdo de Servicios para Empresas, para todo trabajo realizado en una dirección de ${estado}. Si hay conflicto, este anexo prevalece para esos trabajos.`,
  `La ley de ${estado} le da derechos que ningún acuerdo puede quitarle. Nada en nuestros acuerdos los limita.`,
);
const PRO_HOW = (estado: string) => p(
  `Este anexo se suma al Acuerdo de Profesional y sus políticas para todo profesional que viva en ${estado}, tenga su base allí o acepte trabajos allí. Si hay conflicto, este anexo prevalece para ese trabajo.`,
  `La ley de ${estado} le da protecciones que ningún acuerdo puede quitarle. Nada en nuestros acuerdos las limita.`,
);

const NY_CUSTOMER: ContractTranslation = {
  title: "Anexo — Nueva York",
  appliesTo: "Toda reserva de trabajo en una dirección del estado de Nueva York, hogares y empresas.",
  summary: [
    "La ley de Nueva York y los tribunales de Nueva York aplican a los trabajos en Nueva York.",
    "Los trabajos de mejoras del hogar tienen un contrato por escrito con los datos que exige Nueva York, y usted puede cancelarlo dentro de los 3 días hábiles después de firmarlo.",
    "El dinero que usted paga antes de que se termine una mejora del hogar se guarda como lo exige la ley hasta que el trabajo esté hecho.",
    "En la Ciudad de Nueva York y en los condados de Nassau, Suffolk, Westchester, Rockland y Putnam, las mejoras del hogar se hacen con las licencias de mejoras del hogar requeridas.",
    "Se agrega el impuesto sobre las ventas de Nueva York a los servicios gravados (como limpieza, jardinería, remoción de nieve, control de plagas y reparaciones). Las mejoras de capital no pagan impuesto.",
    "Los planes recurrentes le indican el precio y cada cuánto se cobra, y puede cancelarlos en cualquier momento en línea.",
  ],
  sections: numbered([
    ["Cómo funciona este anexo", HOW("Nueva York")],
    ["Ley y tribunales de Nueva York", p(
      "La ley de Nueva York rige cada trabajo realizado en una dirección de Nueva York, salvo la ley federal.",
      "La sección de resolución de disputas de nuestros Términos de Uso sigue aplicando, incluido hablar primero, el arbitraje individual y su derecho a excluirse. El tribunal de reclamos menores siempre está disponible. Si una disputa sobre un trabajo en Nueva York va a juicio, se ve en el condado de Nueva York donde se hizo el trabajo.",
    )],
    ["Mejoras del hogar: su contrato por escrito", p(
      "\"Mejora del hogar\" significa reparar, remodelar, modificar, convertir o modernizar una vivienda o el terreno que la rodea: por ejemplo carpintería, pintura, techos, revestimiento exterior, pisos, cercas, terrazas, concreto, albañilería, ventanas y puertas, y remodelaciones. No incluye la limpieza, el cuidado del césped ni otro mantenimiento que no cambie la vivienda.",
      "En un trabajo de mejora del hogar de más de $500, la confirmación de su reserva y la orden de trabajo son su contrato por escrito. Juntas indican:",
      ul(
        `Los nombres, direcciones y números de licencia de ${L} y de su profesional (cuando se requiere licencia).`,
        "La fecha aproximada de inicio y de terminación.",
        "Una descripción del trabajo y de los materiales principales, con su marca o calidad cuando importe.",
        "El precio y cuándo vence cada pago: la parte que paga al reservar y el resto cuando el trabajo esté terminado.",
        "Su derecho a cancelar (sección siguiente).",
      ),
      `Los cambios a un trabajo de mejora del hogar se hacen solo con una orden de cambio por escrito que usted aprueba en la aplicación antes de que empiece el trabajo adicional.${COUNSEL}`,
    )],
    ["Su derecho a cancelar un contrato de mejora del hogar", p(
      "Puede cancelar un contrato de mejora del hogar sin penalidad ni obligación dentro de los tres días hábiles después de firmarlo (después de reservar y recibir su confirmación).",
      `Para cancelar, use "Cancelar" en la reserva en Mis reservas, escriba a ${BRAND.supportEmail} o envíe por correo una nota firmada y fechada a ${L} a ${ADDRESS || "la dirección de su confirmación"}. Si cancela dentro de los tres días hábiles, le devolvemos todo lo que pagó dentro de 10 días hábiles.`,
      `Su profesional no empezará trabajos de mejora del hogar que no sean de emergencia durante esos tres días, salvo que usted pida por escrito que empiece antes.${COUNSEL}`,
    )],
    ["Pagos antes de terminar una mejora del hogar", p(
      `Nueva York trata el dinero pagado antes de terminar una mejora del hogar como fondos en fideicomiso. Cualquier parte del precio que usted pague antes de que el trabajo esté completo se guarda en una cuenta separada (o se protege de otra forma que la ley permita) y se usa solo para su trabajo, hasta que el trabajo esté hecho o se le devuelva el dinero.${COUNSEL}`,
      "Usted paga el resto del precio solo después de que el trabajo esté hecho y haya visto las fotos del cierre.",
    )],
    ["Licencias en la Ciudad de Nueva York y condados cercanos", p(
      `En la Ciudad de Nueva York, las mejoras del hogar se venden y se hacen con una licencia de contratista de mejoras del hogar del Departamento de Protección al Consumidor y al Trabajador (DCWP). Los condados de Nassau, Suffolk, Westchester, Rockland y Putnam tienen sus propias licencias de mejoras del hogar. ${N} solo envía trabajos de mejoras del hogar en esos lugares a profesionales que tienen la licencia que corresponde, y mostramos los números de licencia en su orden de trabajo.${COUNSEL}`,
      "La plomería, la electricidad y otros oficios con licencia los hacen solo profesionales con licencia donde se realiza el trabajo, con permisos cuando la ley los exige.",
    )],
    ["Impuesto sobre las ventas", p(
      "Se agrega el impuesto sobre las ventas de Nueva York, con la tasa de la dirección del trabajo, a los servicios que Nueva York grava. Entre ellos están la limpieza y el mantenimiento de edificios, el mantenimiento de césped y jardines, la remoción de nieve, el control de plagas y las reparaciones de artículos de su propiedad.",
      "Las mejoras de capital (trabajos que aumentan el valor o la vida de su vivienda y pasan a ser parte permanente de ella) no pagan impuesto. Es posible que le pidamos firmar un Certificado de Mejora de Capital (formulario ST-124) para ese trabajo. El impuesto aparece en su cotización y en su factura.",
    )],
    ["Planes recurrentes", p(
      "Si elige un plan recurrente, le indicamos el precio y cada cuánto se le cobrará antes de que confirme, y le enviamos un recordatorio antes de que el plan se renueve si se renueva por un plazo más largo. Puede cancelar en cualquier momento en Mis reservas, sin necesidad de llamar.",
    )],
    ["Su información", p(
      "Protegemos su información personal con medidas de seguridad razonables, y le avisaremos si una filtración de datos lo afecta, como lo exige la Ley SHIELD de Nueva York.",
    )],
    ["Quejas", p(
      `Díganos primero en ${CONTACT}. También puede comunicarse con la Oficina de Fraudes y Protección al Consumidor del Fiscal General del Estado de Nueva York o, en la Ciudad de Nueva York, con el Departamento de Protección al Consumidor y al Trabajador (llame al 311).`,
    )],
  ]),
};

const NJ_CUSTOMER: ContractTranslation = {
  title: "Anexo — Nueva Jersey",
  appliesTo: "Toda reserva de trabajo en una dirección de Nueva Jersey, hogares y empresas.",
  summary: [
    "La ley de Nueva Jersey y los tribunales de Nueva Jersey aplican a los trabajos en Nueva Jersey.",
    "Los trabajos de mejoras del hogar de más de $500 tienen un contrato por escrito con todo lo que exige Nueva Jersey, incluido el número de registro y los datos del seguro.",
    "Puede cancelar un contrato de mejora del hogar hasta la medianoche del tercer día hábil después de recibirlo, con reembolso completo.",
    "Nunca paga el monto final antes de que el trabajo esté hecho.",
    "Se agrega el impuesto sobre las ventas de Nueva Jersey a los servicios gravados. Las mejoras de capital están exentas con el formulario ST-8.",
    "Este anexo indica qué partes de nuestros términos no aplican a los consumidores de Nueva Jersey.",
  ],
  sections: numbered([
    ["Cómo funciona este anexo", HOW("Nueva Jersey")],
    ["Ley y tribunales de Nueva Jersey", p(
      "La ley de Nueva Jersey rige cada trabajo realizado en una dirección de Nueva Jersey, salvo la ley federal.",
      "Si una disputa sobre un trabajo en Nueva Jersey va a juicio, se ve en el Tribunal Superior de Nueva Jersey del condado donde se hizo el trabajo. Los reclamos dentro de sus límites pueden ir a la Parte Civil Especial (Reclamos Menores).",
    )],
    ["Arbitraje: lo que usted acepta", p(
      "Nuestros Términos de Uso piden que las disputas vayan a arbitraje individual vinculante, salvo que usted se excluya dentro de 30 días. Léalo con atención: si no se excluye, renuncia a su derecho a que un juez o un jurado decida una disputa en un tribunal. En su lugar, la decide un árbitro neutral. Puede seguir usando el tribunal de reclamos menores.",
    )],
    ["Mejoras del hogar: su contrato por escrito", p(
      "\"Mejora del hogar\" significa remodelar, modificar, reparar, pintar, renovar o modernizar una vivienda o propiedad residencial: por ejemplo carpintería, techos, revestimiento exterior, pisos, cercas, terrazas, entradas de auto, concreto, albañilería, ventanas y puertas, y remodelaciones.",
      `Toda empresa que vende o realiza mejoras del hogar en Nueva Jersey debe estar registrada en la División de Asuntos del Consumidor de Nueva Jersey. ${NJ_REG ? `El número de registro de ${L} es ${NJ_REG}, y el de su profesional aparece en su orden de trabajo.` : `Los números de registro de ${L} y de su profesional aparecen en su orden de trabajo.`}${COUNSEL}`,
      "En un trabajo de mejora del hogar de más de $500, la confirmación de su reserva y la orden de trabajo son un contrato por escrito firmado por usted (al reservar) y por nosotros. Juntas indican:",
      ul(
        `El nombre legal, la dirección comercial y el número de registro de ${L} y de su profesional.`,
        "La fecha de inicio y de terminación.",
        "Una descripción del trabajo y de los productos y materiales, con su marca, modelo o calidad cuando corresponda.",
        "El precio total, incluido cualquier cargo financiero (no cobramos ninguno).",
        "Una copia del certificado de seguro de responsabilidad civil general comercial y el teléfono de la aseguradora.",
        "Su derecho a cancelar, con las palabras que exige la ley (sección siguiente).",
      ),
      `Cualquier cambio en el trabajo, el precio o las fechas se hace solo con una orden de cambio por escrito que usted aprueba en la aplicación antes de que empiece el trabajo adicional.${COUNSEL}`,
    )],
    ["Aviso de su derecho a cancelar", p(
      "USTED PUEDE CANCELAR ESTE CONTRATO EN CUALQUIER MOMENTO ANTES DE LA MEDIANOCHE DEL TERCER DÍA HÁBIL DESPUÉS DE RECIBIR UNA COPIA DE ESTE CONTRATO. SI DESEA CANCELAR ESTE CONTRATO, DEBE:",
      ul(
        "ENVIAR UN AVISO DE CANCELACIÓN POR ESCRITO, FIRMADO Y FECHADO, POR CORREO REGISTRADO O CERTIFICADO CON ACUSE DE RECIBO; O",
        `ENTREGAR PERSONALMENTE UN AVISO DE CANCELACIÓN POR ESCRITO, FIRMADO Y FECHADO, A: ${L.toUpperCase()}, ${ADDRESS ? ADDRESS.toUpperCase() : "EN LA DIRECCIÓN POSTAL DE SU CONFIRMACIÓN"}, ${BRAND.supportPhone}.`,
      ),
      "SI CANCELA ESTE CONTRATO DENTRO DEL PLAZO DE TRES DÍAS, TIENE DERECHO AL REEMBOLSO COMPLETO DE SU DINERO. LOS REEMBOLSOS DEBEN HACERSE DENTRO DE LOS 30 DÍAS SIGUIENTES A QUE RECIBAMOS EL AVISO DE CANCELACIÓN.",
      `También puede cancelar en Mis reservas o escribiendo a ${BRAND.supportEmail}; también lo aceptamos. La ley fija las palabras exactas de este aviso en inglés, y ese texto en inglés prevalece.${COUNSEL}`,
    )],
    ["Pagos y terminación", p(
      "Usted paga parte del precio al reservar y el resto solo cuando el trabajo esté terminado y haya visto las fotos del cierre. Nunca pedimos el pago final antes de que el trabajo esté completo, incluidas las inspecciones que exija el permiso.",
      "Cuando un trabajo necesita un permiso de construcción, el profesional (o nosotros) lo obtiene antes de empezar, y el trabajo no está completo hasta que pase las inspecciones requeridas.",
    )],
    ["Impuesto sobre las ventas", p(
      "Se agrega el impuesto sobre las ventas de Nueva Jersey (6.625%, o la tasa reducida donde aplique) a los servicios que Nueva Jersey grava. Entre ellos están los servicios de limpieza y conserjería, el paisajismo y el cuidado del césped, las reparaciones y el mantenimiento de propiedades, y el control de plagas.",
      "Las mejoras de capital a bienes inmuebles están exentas cuando nos entrega un Certificado de Mejora de Capital Exenta (formulario ST-8) completo. El impuesto aparece en su cotización y en su factura.",
    )],
    ["Partes de nuestros términos que no aplican a los consumidores de Nueva Jersey", p(
      "Si usted es un consumidor de Nueva Jersey, estas partes de nuestros acuerdos no le aplican, en la medida en que la ley de Nueva Jersey no las permita:",
      ul(
        "En los Términos de Uso, \"Límites de nuestra responsabilidad\": la exclusión de daños punitivos y cualquier límite a nuestra responsabilidad por nuestra propia negligencia que la ley de Nueva Jersey no permita.",
        "En el Acuerdo de Servicio, \"Daños a la propiedad\": el tope de nuestra responsabilidad al monto que usted pagó, cuando el daño lo causó nuestra negligencia o la del profesional.",
        "En los Términos de Uso, \"Su responsabilidad por mal uso\": cualquier obligación de pagar nuestros honorarios legales, salvo lo que ordene un tribunal o un árbitro según la ley de Nueva Jersey.",
      ),
      `Todo lo demás de nuestros acuerdos aplica.${COUNSEL}`,
    )],
    ["Quejas", p(
      `Díganos primero en ${CONTACT}. También puede comunicarse con la División de Asuntos del Consumidor de Nueva Jersey.`,
    )],
  ]),
};

const NV_CUSTOMER: ContractTranslation = {
  title: "Anexo — Nevada",
  appliesTo: "Toda reserva de trabajo en una dirección de Nevada (por ahora atendemos el área de Las Vegas), hogares y empresas.",
  summary: [
    "La ley de Nevada y los tribunales del condado de Clark (o del condado donde se hizo el trabajo) aplican a los trabajos en Nevada.",
    "El trabajo que necesita licencia de contratista de Nevada lo hacen solo profesionales con licencia de la Junta Estatal de Contratistas de Nevada, dentro del límite de su licencia.",
    "Los propietarios pueden recibir ayuda del Fondo de Recuperación Residencial de la Junta de Contratistas.",
    "Nevada no grava la mayoría de los servicios. Los artículos y materiales que se le venden pagan el impuesto local.",
    "El control de plagas lo hacen solo profesionales con licencia del Departamento de Agricultura de Nevada.",
  ],
  sections: numbered([
    ["Cómo funciona este anexo", HOW("Nevada")],
    ["Ley y tribunales de Nevada", p(
      "La ley de Nevada rige cada trabajo realizado en una dirección de Nevada, salvo la ley federal.",
      "La sección de resolución de disputas de nuestros Términos de Uso sigue aplicando, incluido hablar primero, el arbitraje individual y su derecho a excluirse. El tribunal de reclamos menores (Justice Court) siempre está disponible. Si una disputa sobre un trabajo en Nevada va a juicio, se ve en el condado donde se hizo el trabajo, como el condado de Clark.",
    )],
    ["Trabajo de contratista con licencia", p(
      "En Nevada, la mayoría de los trabajos de construcción, reparación y mejoras necesitan una licencia de la Junta Estatal de Contratistas de Nevada (NSCB). La licencia tiene un límite de monto: el trabajo más grande que el contratista puede aceptar.",
      "En un trabajo que necesita licencia, su orden de trabajo muestra el número y la clasificación de la licencia NSCB del profesional. Solo lo enviamos a un profesional cuya licencia cubra ese tipo de trabajo y cuyo límite cubra el precio.",
      `Los trabajos pequeños que la ley de Nevada permite hacer a un ayudante sin licencia (handyman) los puede hacer un profesional sin licencia de contratista. En general, son trabajos de menos de $1,000 en total entre mano de obra y materiales, que no necesitan permiso de construcción y no son parte de un proyecto más grande.${COUNSEL}`,
      "Cuando se requiere un permiso de construcción, el profesional lo obtiene antes de empezar.",
    )],
    ["Trabajo residencial: el Fondo de Recuperación y su contrato por escrito", p(
      "Si contrata a un contratista con licencia para trabajar en su propia vivienda, el Fondo de Recuperación Residencial de la Junta Estatal de Contratistas de Nevada puede ayudarle si el contratista no hace bien el trabajo. Puede informarse en nscb.nv.gov o llamando a la Junta.",
      `En un trabajo residencial que necesita licencia, la confirmación de su reserva y la orden de trabajo son su contrato por escrito. Indican el nombre del contratista, su número y límite de licencia, una descripción del trabajo, el precio, el calendario de pagos y las fechas de inicio y terminación, junto con cualquier otro aviso que Nevada exija para ese tipo de trabajo (por ejemplo, piscinas y spas).${COUNSEL}`,
      "Los cambios se hacen solo con una orden de cambio por escrito que usted aprueba en la aplicación antes de que empiece el trabajo adicional.",
    )],
    ["Control de plagas y otros servicios con licencia", p(
      "El control de plagas lo hacen solo profesionales con licencia del Departamento de Agricultura de Nevada. Otros servicios que necesitan licencia o certificado de Nevada los hacen solo profesionales que lo tienen.",
    )],
    ["Impuestos", p(
      "Nevada no cobra impuesto sobre las ventas en la mayoría de los servicios. Los artículos y materiales que se le venden como parte de un trabajo pagan impuesto con la tasa de la dirección del trabajo (la del condado de Clark en el área de Las Vegas). El impuesto aparece en su cotización y en su factura.",
    )],
    ["Quejas", p(
      `Díganos primero en ${CONTACT}. También puede comunicarse con la Junta Estatal de Contratistas de Nevada (para trabajo de contratistas) o con la Unidad de Asuntos del Consumidor del Departamento de Negocios e Industria de Nevada.`,
    )],
  ]),
};

const NY_PRO: ContractTranslation = {
  title: "Anexo de Nueva York (profesionales)",
  appliesTo: "Profesionales que viven en Nueva York, tienen su base allí o aceptan trabajos en direcciones de Nueva York. Se firma con el Acuerdo de Profesional.",
  summary: [
    "El Acuerdo de Profesional y cada orden de trabajo son juntos su contrato por escrito según la Ley Freelance Isn't Free de Nueva York.",
    "Se le paga cada lunes por el trabajo aprobado, y nunca más de 30 días después de terminar un trabajo.",
    "Aplican la ley de Nueva York y los tribunales de donde usted vive o trabaja.",
    "Las mejoras del hogar en la Ciudad de Nueva York y en los condados de Nassau, Suffolk, Westchester, Rockland y Putnam necesitan la licencia local de mejoras del hogar.",
    "Si tiene empleados, debe tener el seguro de compensación laboral y el seguro de incapacidad y licencia familiar pagada de Nueva York.",
  ],
  sections: numbered([
    ["Cómo funciona este anexo", PRO_HOW("Nueva York")],
    ["Su contrato por escrito (Ley Freelance Isn't Free)", p(
      "La Ley Freelance Isn't Free del estado de Nueva York, y la ley con el mismo nombre de la Ciudad de Nueva York, protegen a los trabajadores independientes que cobran $800 o más, por un trabajo o por varios trabajos en 120 días. Para todo trabajo que haga en Nueva York, el Acuerdo de Profesional y la orden de trabajo son su contrato por escrito. Juntos indican:",
      ul(
        `Los nombres y direcciones postales de usted y de ${L}.`,
        "Una lista detallada del trabajo (el alcance de la orden de trabajo).",
        "Cuánto y cómo se le pagará (su pago en la orden de trabajo, con propinas, pago por presentarse o bonos).",
        "Cuándo se le pagará: el pago del lunes después de que el trabajo se revise y apruebe.",
        "Cuándo debe terminar su parte para cobrar en esa fecha: completar el trabajo en la aplicación con las fotos del cierre.",
      ),
      "Puede descargar una copia de todo lo que firmó, y de cada orden de trabajo, desde el portal del profesional en cualquier momento. Guardamos estos registros por al menos seis años.",
    )],
    ["Pagarle a tiempo", p(
      "El trabajo aprobado se paga cada lunes, como dice el Acuerdo de Profesional. Ningún pago por trabajo terminado se hace nunca más de 30 días después de que usted complete el trabajo, aunque se esté revisando un problema del cliente. Si una revisión sigue abierta el día 30, le pagamos y resolvemos cualquier ajuste después según el Acuerdo de Profesional.",
      `Nunca haremos que cobrar a tiempo dependa de que acepte menos dinero, de que trabaje solo a través de ${N} o de que renuncie a algún derecho. No lo sancionaremos, amenazaremos ni desactivaremos por ejercer sus derechos según estas leyes ni por presentar una queja.${COUNSEL}`,
    )],
    ["Ley y tribunales de Nueva York", p(
      "Si vive o trabaja en Nueva York, la ley de Nueva York rige el Acuerdo de Profesional para ese trabajo, salvo la ley federal. Si algo va a juicio, se ve en el condado de Nueva York donde usted vive o trabaja. La sección de arbitraje del Acuerdo de Profesional sigue aplicando salvo que se haya excluido, y nada en ella le impide presentar una queja ante el Departamento de Trabajo del estado de Nueva York o el Departamento de Protección al Consumidor y al Trabajador de la Ciudad de Nueva York.",
    )],
    ["Licencias", p(
      "Antes de aceptar estos trabajos, suba su licencia al portal del profesional:",
      ul(
        "Mejoras del hogar en la Ciudad de Nueva York: licencia de contratista de mejoras del hogar del Departamento de Protección al Consumidor y al Trabajador de la Ciudad de Nueva York.",
        "Mejoras del hogar en los condados de Nassau, Suffolk, Westchester, Rockland o Putnam: la licencia de mejoras del hogar de ese condado.",
        "Plomería, electricidad y otros oficios con licencia: la licencia que se exige donde se hace el trabajo (por ejemplo, la licencia de maestro plomero o electricista de la Ciudad de Nueva York del Departamento de Edificios).",
        "Control de plagas: certificación como aplicador comercial de pesticidas del Departamento de Conservación Ambiental del estado de Nueva York, trabajando para una empresa registrada.",
      ),
      `No acepte un trabajo que necesite una licencia que no tiene. Muestre su número de licencia en la orden de trabajo cuando la ley lo exija.${COUNSEL}`,
    )],
    ["Compensación laboral y seguro de incapacidad", p(
      "Si tiene empleados o ayudantes en trabajos de Nueva York, debe tener para ellos el seguro de compensación laboral y el seguro de incapacidad y licencia familiar pagada de Nueva York, y subir el comprobante. Si trabaja solo sin empleados, puede presentar en su lugar el formulario de exención de Nueva York (CE-200), que también piden las licencias de mejoras del hogar.",
    )],
    ["Impuesto sobre las ventas en sus trabajos", p(
      `${N} cobra al cliente el impuesto sobre las ventas de Nueva York cuando aplica. No le cobre usted impuestos al cliente en los trabajos de ${N}.`,
    )],
  ]),
};

const NJ_PRO: ContractTranslation = {
  title: "Anexo de Nueva Jersey (profesionales)",
  appliesTo: "Profesionales que viven en Nueva Jersey, tienen su base allí o aceptan trabajos en direcciones de Nueva Jersey. Se firma con el Acuerdo de Profesional.",
  summary: [
    "Usted tiene su propio negocio independiente: su propio registro, seguro, herramientas, horario y otros clientes.",
    "Las mejoras del hogar en Nueva Jersey necesitan su propio registro en la División de Asuntos del Consumidor y al menos $500,000 de seguro de responsabilidad civil general.",
    "La plomería, la electricidad, la climatización (HVAC) y el control de plagas necesitan la licencia de Nueva Jersey para ese oficio.",
    "Los clientes de mejoras del hogar tienen 3 días hábiles para cancelar, así que no empiece trabajos que no sean de emergencia antes de ese plazo, salvo que lo pidan por escrito.",
    "Aplican la ley de Nueva Jersey y los tribunales de donde usted vive o trabaja. Si la ley de Nueva Jersey lo trata como empleado para algún fin, usted recibe esas protecciones.",
  ],
  sections: numbered([
    ["Cómo funciona este anexo", PRO_HOW("Nueva Jersey")],
    ["Su negocio independiente", p(
      "Nueva Jersey usa una prueba estricta para decidir si alguien es un contratista independiente. Usted lo es solo si no está bajo nuestro control sobre cómo hace el trabajo y tiene un negocio propio establecido de forma independiente. Para el trabajo en Nueva Jersey, usted confirma y acepta que:",
      ul(
        "Usted decide cómo, cuándo y si hace cada trabajo. Puede rechazar cualquier oferta, fijar su propio horario y días libres y elegir sus métodos, dentro del alcance del cliente y de la ley.",
        "Usted tiene su propio negocio. Tiene un Certificado de Registro Comercial de Nueva Jersey (o el registro que necesite su tipo de negocio) y lo mantiene vigente.",
        "Usted ofrece sus servicios al público y es libre de trabajar para otros clientes y plataformas, incluidos competidores.",
        "Usted usa sus propias herramientas, equipo y vehículo, y tiene su propio seguro.",
        "Usted puede contratar ayudantes o empleados, por su cuenta y bajo su responsabilidad.",
      ),
      `${N} opera un mercado que conecta a clientes con negocios de servicios independientes. No supervisamos cómo hace el trabajo más allá del alcance del cliente, las reglas de seguridad y la revisión de calidad que se le promete al cliente.`,
      `Si un tribunal o una agencia decide que la ley de Nueva Jersey lo trata como empleado para algún fin (por ejemplo, el seguro de desempleo o el pago de salarios), usted recibe las protecciones que esa ley da para ese fin, y nada en nuestros acuerdos renuncia a ellas.${COUNSEL}`,
    )],
    ["Registro de mejoras del hogar y seguro", p(
      "Para hacer mejoras del hogar en propiedades residenciales de Nueva Jersey (por ejemplo carpintería, pintura, techos, revestimiento exterior, pisos, cercas, terrazas, concreto, albañilería, ventanas y puertas, y remodelaciones), usted debe:",
      ul(
        "Estar registrado como contratista de mejoras del hogar en la División de Asuntos del Consumidor de Nueva Jersey, y subir su número de registro.",
        "Tener un seguro de responsabilidad civil general comercial de al menos $500,000 por incidente, y subir el certificado. Los clientes reciben una copia con su contrato.",
        "Poner su número de registro en sus órdenes de trabajo, facturas y cualquier publicidad.",
      ),
      `${N} solo le ofrece trabajos de mejoras del hogar en Nueva Jersey cuando se verifican su registro y su seguro.${COUNSEL}`,
    )],
    ["Oficios con licencia", p(
      "Estos necesitan una licencia o certificación de Nueva Jersey antes de aceptar el trabajo, subida al portal del profesional:",
      ul(
        "Plomería: licencia de maestro plomero de Nueva Jersey (Junta Estatal de Maestros Plomeros), o trabajar bajo una.",
        "Electricidad: licencia de contratista eléctrico de Nueva Jersey, o trabajar bajo una.",
        "Calefacción, ventilación, aire acondicionado y refrigeración: licencia de contratista HVACR de Nueva Jersey.",
        "Control de plagas: certificación de aplicador de pesticidas del Departamento de Protección Ambiental de Nueva Jersey, trabajando para una empresa con licencia.",
        "Trabajo que altera la pintura en viviendas construidas antes de 1978: certificación de trabajo seguro con plomo de la EPA (RRP).",
      ),
    )],
    ["Contratos de mejoras del hogar y el derecho a cancelar", p(
      "Los clientes de mejoras del hogar en Nueva Jersey reciben un contrato por escrito y pueden cancelar hasta la medianoche del tercer día hábil después de recibirlo. La aplicación le da al cliente el contrato y el aviso de cancelación cuando reserva.",
      ul(
        "No empiece trabajos de mejoras del hogar que no sean de emergencia antes de que termine el plazo de cancelación, salvo que el cliente pida por escrito que empiece antes.",
        "Haga todo cambio en el trabajo, el precio o las fechas con una orden de cambio que el cliente apruebe en la aplicación antes de hacer el trabajo adicional. Nunca acuerde cambios fuera de la aplicación.",
        "Obtenga los permisos que necesite el trabajo antes de empezar, y no dé por terminado el trabajo hasta que pase cualquier inspección requerida.",
      ),
      COUNSEL.trim(),
    )],
    ["Ley y tribunales de Nueva Jersey", p(
      "Si vive o trabaja en Nueva Jersey, la ley de Nueva Jersey rige el Acuerdo de Profesional para ese trabajo, salvo la ley federal. Si algo va a juicio, se ve en el Tribunal Superior de Nueva Jersey del condado donde usted vive o trabaja. La sección de arbitraje del Acuerdo de Profesional sigue aplicando salvo que se haya excluido. Si no se excluye, renuncia a su derecho a que un juez o un jurado decida una disputa en un tribunal. Nada en ella le impide presentar una queja ante el Departamento de Trabajo y Desarrollo de la Fuerza Laboral de Nueva Jersey.",
    )],
    ["Impuesto sobre las ventas en sus trabajos", p(
      `${N} cobra al cliente el impuesto sobre las ventas de Nueva Jersey cuando aplica. No le cobre usted impuestos al cliente en los trabajos de ${N}.`,
    )],
  ]),
};

const NV_PRO: ContractTranslation = {
  title: "Anexo de Nevada (profesionales)",
  appliesTo: "Profesionales que viven en Nevada, tienen su base allí o aceptan trabajos en direcciones de Nevada. Se firma con el Acuerdo de Profesional.",
  summary: [
    "Necesita una Licencia Comercial Estatal de Nevada y la licencia comercial local de donde trabaja (por ejemplo el condado de Clark, Las Vegas, Henderson o North Las Vegas).",
    "Los trabajos de construcción y reparación necesitan una licencia de la Junta Estatal de Contratistas de Nevada. No acepte un trabajo por encima del límite de su licencia ni fuera de su clasificación.",
    "Sin licencia de contratista, solo se permiten trabajos pequeños de handyman (en general, menos de $1,000 en total, sin permiso y que no sean parte de un proyecto más grande).",
    "El control de plagas necesita una licencia del Departamento de Agricultura de Nevada.",
    "Usted tiene su propio negocio independiente. Aplican la ley de Nevada y los tribunales de donde vive o trabaja.",
  ],
  sections: numbered([
    ["Cómo funciona este anexo", PRO_HOW("Nevada")],
    ["Licencias comerciales", p(
      "Para hacer negocios en Nevada necesita una Licencia Comercial Estatal de Nevada de la Secretaría de Estado (salvo que su negocio esté exento) y la licencia comercial de la ciudad o el condado donde trabaja: por ejemplo el condado de Clark, la Ciudad de Las Vegas, Henderson o North Las Vegas. Súbalas al portal del profesional y manténgalas vigentes.",
    )],
    ["Licencia de contratista y sus límites", p(
      "La mayoría de los trabajos de construcción, reparación y mejoras en Nevada necesitan una licencia de la Junta Estatal de Contratistas de Nevada (NSCB), en la clasificación de ese trabajo. Su licencia también tiene un límite de monto: el trabajo más grande que puede aceptar.",
      ul(
        "Suba el número, la clasificación y el límite de su licencia NSCB. Sus órdenes de trabajo los muestran.",
        "No acepte un trabajo fuera de su clasificación ni con un precio mayor a su límite.",
        "Sin licencia NSCB, solo puede hacer los trabajos pequeños de handyman que permite la ley de Nevada. En general, son trabajos de menos de $1,000 en total entre mano de obra y materiales, que no necesitan permiso de construcción y no son parte de un proyecto más grande. No divida un trabajo grande en varios pequeños y no se anuncie como contratista.",
        "Obtenga los permisos que necesite el trabajo antes de empezar.",
      ),
      COUNSEL.trim(),
    )],
    ["Otros servicios con licencia", p(
      "El control de plagas necesita una licencia del Departamento de Agricultura de Nevada, y usted debe trabajar para una empresa con licencia. El trabajo de piscinas y spas, la contratación de paisajismo y otros trabajos especializados necesitan la clasificación NSCB de ese trabajo cuando superan el límite de handyman. Suba cada licencia antes de aceptar esos trabajos.",
    )],
    ["Su negocio independiente", p(
      "La ley de Nevada presume que usted es un contratista independiente cuando tiene los registros que necesita su negocio y cumple las condiciones de la ley de Nevada. Para el trabajo en Nevada, usted confirma y acepta que:",
      ul(
        "Usted controla cómo hace el trabajo, su horario y qué trabajos acepta, dentro del alcance del cliente y de la ley.",
        `Usted es libre de trabajar para otros, incluidas otras plataformas y sus propios clientes. ${N} no le exige trabajar solo a través de nosotros.`,
        "Usted puede contratar empleados o ayudantes, por su cuenta y bajo su responsabilidad.",
        "Usted aporta sus propias herramientas, equipo y vehículo, y tiene los registros comerciales y las licencias que indica este anexo.",
      ),
      `Si un tribunal o una agencia decide que la ley de Nevada lo trata como empleado para algún fin, usted recibe las protecciones que esa ley da para ese fin.${COUNSEL}`,
    )],
    ["Seguridad ante el calor", p(
      "Los veranos de Las Vegas son peligrosos para el trabajo al aire libre. Programe los trabajos al aire libre en las horas más frescas cuando el cliente lo permita, lleve agua, tome descansos a la sombra y deténgase si usted o un ayudante muestra señales de enfermedad por calor. Si tiene empleados, le aplican las reglas de Nevada sobre enfermedades por calor para empleadores. Puede mover o cancelar un trabajo por calor peligroso sin ninguna penalidad.",
    )],
    ["Ley y tribunales de Nevada", p(
      "Si vive o trabaja en Nevada, la ley de Nevada rige el Acuerdo de Profesional para ese trabajo, salvo la ley federal. Si algo va a juicio, se ve en el condado donde usted vive o trabaja, como el condado de Clark. La sección de arbitraje del Acuerdo de Profesional sigue aplicando salvo que se haya excluido. Nada en ella le impide presentar una queja ante el Comisionado Laboral de Nevada.",
    )],
    ["Impuestos en sus trabajos", p(
      `Nevada no grava la mayoría de los servicios. ${N} cobra cualquier impuesto sobre las ventas que corresponda por los materiales vendidos al cliente. No le cobre usted impuestos al cliente en los trabajos de ${N}.`,
    )],
  ]),
};

export const STATE_ES: Record<string, ContractTranslation> = {
  "addendum-new-york": NY_CUSTOMER,
  "addendum-new-jersey": NJ_CUSTOMER,
  "addendum-nevada": NV_CUSTOMER,
  "pro-addendum-new-york": NY_PRO,
  "pro-addendum-new-jersey": NJ_PRO,
  "pro-addendum-nevada": NV_PRO,
};
