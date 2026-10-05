/*
 * FILE    : apps/web/lib/contracts/talent.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_2034 UTC
 * PURPOSE : Handled Talent Client Agreement (businesses that hire through our recruiting service), English and Spanish.
 *           Terms come from core TALENT_TERMS so the website, invoices and this agreement always match:
 *           contingency fee (% of first-year base salary, due only on a hire), retained search in three payments,
 *           90-day guarantee (replacement or prorated refund), 12-month candidate ownership, net 30, candidates never pay.
 *           TEMPLATE — not legal advice; have counsel review before use.
 */
import { BRAND, TALENT_TERMS as T } from "@handled/core";
import type { Contract, ContractSection, ContractTranslation } from "./types";

const V1 = "2026-10-v1";
const COUNSEL = " [Confirm with counsel.]";
const COUNSEL_ES = " [Confirmar con un abogado.]";
const N = `${BRAND.name} Talent`;
const p = (...paras: string[]) => paras.join("\n\n");
const ul = (...items: string[]) => items.map((i) => `• ${i}`).join("\n");
const numbered = (items: [string, string][]): ContractSection[] => items.map(([h, body], i) => ({ h: `${i + 1}. ${h}`, p: body }));

export const TALENT_CLIENT_AGREEMENT: Contract = {
  key: "talent-client-agreement",
  title: `${N} Client Agreement (Recruiting Services)`,
  version: V1,
  audience: "business",
  appliesTo: `Companies that ask ${N} to find candidates for a job (contingency or retained search).`,
  summary: [
    `Contingency search: ${T.contingencyPct}% of the hire's first-year base salary, owed only if you hire someone we introduce.`,
    `Retained search: ${T.retainedPct}% of first-year base salary, paid in three parts (start, shortlist, hire); the last part is adjusted to the actual salary.`,
    `Invoices are due ${T.invoiceDueDays} days after the start date (retained: ${T.invoiceDueDays} days after each invoice).`,
    `${T.guaranteeDays}-day guarantee: if a hire resigns or is let go for performance or cause, we run a free replacement search or refund part of the fee.`,
    `A candidate we introduce is ours for ${T.ownershipMonths} months: if you hire them for any role in that time, the fee applies.`,
    "Candidates never pay us anything. We don't screen anyone out for a protected reason, and we won't take a search that asks us to.",
    "You make every hiring decision and are the employer. We don't employ the people you hire.",
  ],
  sections: numbered([
    ["Our service", p(
      `${N} (part of ${BRAND.legalName}) finds, screens and introduces candidates for the jobs you give us ("searches"). Our recruiters are independent recruiting professionals working through ${BRAND.name}; ${BRAND.name} is your single point of contact and is responsible for the service under this agreement.`,
      "For each search we agree on the job, the salary range, must-haves, the interview process and whether it's contingency or retained. We send candidates with a written summary and résumé through your private search page, and you tell us interview, pass or hold.",
    )],
    ["Contingency fee", p(
      `When you hire a candidate we introduced, the fee is ${T.contingencyPct}% of their first-year base salary${T.minimumFee ? `, with a minimum fee of $${T.minimumFee.toLocaleString("en-US")}` : ""}. "Base salary" is the annual base pay in the offer (for hourly roles, the hourly rate × 2,080 hours), not counting bonuses, commissions or benefits, unless a search states otherwise.`,
      "No hire, no fee. A hire means any employment or contractor engagement of the candidate by you or your affiliates, for any role, within the ownership period (section 5).",
      `Tell us the offer, base salary and start date within 2 business days of the candidate accepting. We invoice on the start date; payment is due ${T.invoiceDueDays} days after the start date.`,
    )],
    ["Retained search", p(
      `A retained search is a dedicated search with a defined process and timeline. The fee is ${T.retainedPct}% of the first-year base salary, estimated from the top of the agreed salary range and paid in three equal parts:`,
      ul(
        "First payment when the search starts (non-refundable — it pays for the search work).",
        `Second payment when we present the shortlist or ${T.shortlistDays} days after the start, whichever comes first.`,
        "Final payment on the hire's start date, adjusted so the total equals the fee on the actual base salary (never below zero; we don't refund the first two payments if the salary is lower).",
      ),
      "If you cancel a retained search, payments already due stay due. If you later hire a candidate we introduced, the full fee applies, less retained payments already made.",
    )],
    ["Guarantee", p(
      `If a hire leaves within ${T.guaranteeDays} days of their start date because they resign or you let them go for performance or cause, and the fee was paid on time, you may choose:`,
      ul(
        "A free replacement search for the same role (one replacement per hire), or",
        `A refund of the fee prorated by the days left in the ${T.guaranteeDays}-day period.`,
      ),
      "The guarantee doesn't apply to layoffs, eliminated or restructured roles, a material change to the job or pay, or where the fee was paid late. Tell us within 5 business days of the person leaving.",
    )],
    ["Candidate ownership and no hiring around us", p(
      `A candidate is "introduced" by us when we send you their name or résumé for any search. For ${T.ownershipMonths} months after the introduction, if you or your affiliates hire that person for any role, directly or through another party, the fee in section 2 applies. If you already had the candidate in your active process, tell us within 2 business days of our introduction with proof, and no fee applies for that person.`,
      "Please don't share our candidates' information outside your hiring team or with other recruiters.",
    )],
    ["Fair and lawful hiring", p(
      "We recruit on skills, experience and the job's real requirements. We won't source, screen or reject anyone because of age, race, color, religion, sex, pregnancy, sexual orientation, gender identity, national origin, disability, genetic information, height, weight, marital or familial status, veteran status or any other protected trait, and we won't take a search that asks us to.",
      "You make the hiring decision, set the job requirements, and are responsible for your interviews, background checks (with the notices and consents the law requires), offers, employment eligibility checks and employment terms. We may use software, including AI, to help find, summarize and schedule; a person makes every decision to submit a candidate." + COUNSEL,
    )],
    ["Candidates' information", p(
      "We share a candidate's information with you only with their consent, for the search they agreed to. Use it only to consider them for employment, keep it confidential and secure, and delete it when you no longer need it or when we ask because the candidate requested it.",
    )],
    ["Payment and late fees", p(
      `Invoices are payable by card or bank transfer from the link on the invoice, or by wire. Past-due balances may incur a late charge of 1.5% per month (or the legal maximum, if lower), and we may pause your searches until they're paid. You pay reasonable collection costs if an invoice goes to collection.` + COUNSEL,
    )],
    ["Not employment; limits", p(
      `${BRAND.name} doesn't employ the people you hire and isn't responsible for their work, conduct or how long they stay (beyond the guarantee). We don't guarantee that a search will be filled. To the extent the law allows, our total liability under this agreement is limited to the fees you paid for the search the claim is about, and neither of us is liable for lost profits or indirect damages.` + COUNSEL,
    )],
    ["Term and general", p(
      "This agreement covers every search you give us until either of us ends it with written notice. Fees for hires of candidates introduced before it ends stay owed. Changes to the fee for a particular search are made in writing (email is fine). Michigan law governs. If any part is unenforceable, the rest stays in effect.",
    )],
  ]),
};

export const TALENT_CLIENT_AGREEMENT_ES: ContractTranslation = {
  title: `${N} — Contrato de Cliente (Servicios de Reclutamiento)`,
  appliesTo: `Empresas que piden a ${N} encontrar candidatos para un puesto (búsqueda por contingencia o con anticipo).`,
  summary: [
    `Búsqueda por contingencia: ${T.contingencyPct}% del salario base del primer año de la persona contratada, solo si usted contrata a alguien que le presentamos.`,
    `Búsqueda con anticipo (retained): ${T.retainedPct}% del salario base del primer año, en tres pagos (inicio, lista final, contratación); el último se ajusta al salario real.`,
    `Las facturas vencen ${T.invoiceDueDays} días después de la fecha de inicio (con anticipo: ${T.invoiceDueDays} días después de cada factura).`,
    `Garantía de ${T.guaranteeDays} días: si la persona renuncia o es despedida por desempeño o causa, hacemos una búsqueda de reemplazo gratis o reembolsamos parte de la tarifa.`,
    `Un candidato que presentamos es nuestro por ${T.ownershipMonths} meses: si lo contrata para cualquier puesto en ese tiempo, se aplica la tarifa.`,
    "Los candidatos nunca nos pagan nada. No descartamos a nadie por un motivo protegido, y no aceptamos búsquedas que nos pidan hacerlo.",
    "Usted toma cada decisión de contratación y es el empleador. No empleamos a las personas que usted contrata.",
  ],
  sections: numbered([
    ["Nuestro servicio", p(
      `${N} (parte de ${BRAND.legalName}) encuentra, evalúa y presenta candidatos para los puestos que usted nos encarga ("búsquedas"). Nuestros reclutadores son profesionales independientes que trabajan a través de ${BRAND.name}; ${BRAND.name} es su único punto de contacto y es responsable del servicio según este contrato.`,
      "Para cada búsqueda acordamos el puesto, el rango salarial, los requisitos indispensables, el proceso de entrevistas y si es por contingencia o con anticipo. Le enviamos candidatos con un resumen escrito y su currículum a través de su página privada de búsqueda, y usted nos indica entrevistar, descartar o en espera.",
    )],
    ["Tarifa por contingencia", p(
      `Cuando usted contrata a un candidato que le presentamos, la tarifa es el ${T.contingencyPct}% de su salario base del primer año${T.minimumFee ? `, con una tarifa mínima de $${T.minimumFee.toLocaleString("en-US")}` : ""}. "Salario base" es el pago base anual de la oferta (para puestos por hora, la tarifa por hora × 2,080 horas), sin contar bonos, comisiones ni beneficios, salvo que una búsqueda indique otra cosa.`,
      "Sin contratación, no hay tarifa. Una contratación es cualquier empleo o contratación como contratista del candidato por usted o sus afiliadas, para cualquier puesto, dentro del período de titularidad (sección 5).",
      `Avísenos la oferta, el salario base y la fecha de inicio dentro de los 2 días hábiles siguientes a que el candidato acepte. Facturamos en la fecha de inicio; el pago vence ${T.invoiceDueDays} días después de la fecha de inicio.`,
    )],
    ["Búsqueda con anticipo", p(
      `Una búsqueda con anticipo es una búsqueda dedicada con un proceso y un calendario definidos. La tarifa es el ${T.retainedPct}% del salario base del primer año, estimado con el tope del rango salarial acordado y pagado en tres partes iguales:`,
      ul(
        "Primer pago al iniciar la búsqueda (no reembolsable: cubre el trabajo de búsqueda).",
        `Segundo pago al presentar la lista final o ${T.shortlistDays} días después del inicio, lo que ocurra primero.`,
        "Pago final en la fecha de inicio de la persona contratada, ajustado para que el total sea igual a la tarifa sobre el salario base real (nunca menos de cero; no reembolsamos los dos primeros pagos si el salario es menor).",
      ),
      "Si usted cancela una búsqueda con anticipo, los pagos ya vencidos siguen debiéndose. Si después contrata a un candidato que le presentamos, se aplica la tarifa completa, menos los pagos de anticipo ya hechos.",
    )],
    ["Garantía", p(
      `Si una persona contratada se va dentro de los ${T.guaranteeDays} días siguientes a su fecha de inicio porque renuncia o usted la despide por desempeño o causa, y la tarifa se pagó a tiempo, usted puede elegir:`,
      ul(
        "Una búsqueda de reemplazo gratis para el mismo puesto (un reemplazo por contratación), o",
        `Un reembolso de la tarifa proporcional a los días que faltan del período de ${T.guaranteeDays} días.`,
      ),
      "La garantía no aplica a despidos colectivos, puestos eliminados o reestructurados, un cambio importante del puesto o del pago, ni cuando la tarifa se pagó tarde. Avísenos dentro de los 5 días hábiles siguientes a la salida de la persona.",
    )],
    ["Titularidad del candidato y no contratar por fuera", p(
      `Un candidato queda "presentado" por nosotros cuando le enviamos su nombre o currículum para cualquier búsqueda. Durante ${T.ownershipMonths} meses después de la presentación, si usted o sus afiliadas contratan a esa persona para cualquier puesto, directamente o a través de otra parte, se aplica la tarifa de la sección 2. Si usted ya tenía al candidato en un proceso activo, avísenos con pruebas dentro de los 2 días hábiles siguientes a nuestra presentación, y no se aplica tarifa por esa persona.`,
      "Por favor no comparta la información de nuestros candidatos fuera de su equipo de contratación ni con otros reclutadores.",
    )],
    ["Contratación justa y legal", p(
      "Reclutamos según habilidades, experiencia y los requisitos reales del puesto. No buscamos, evaluamos ni rechazamos a nadie por edad, raza, color, religión, sexo, embarazo, orientación sexual, identidad de género, origen nacional, discapacidad, información genética, estatura, peso, estado civil o familiar, condición de veterano ni ningún otro rasgo protegido, y no aceptamos búsquedas que nos pidan hacerlo.",
      "Usted toma la decisión de contratación, fija los requisitos del puesto y es responsable de sus entrevistas, verificaciones de antecedentes (con los avisos y consentimientos que exige la ley), ofertas, verificación de elegibilidad para trabajar y condiciones de empleo. Podemos usar software, incluida la IA, para ayudar a buscar, resumir y programar; una persona toma cada decisión de presentar a un candidato." + COUNSEL_ES,
    )],
    ["Información de los candidatos", p(
      "Compartimos la información de un candidato con usted solo con su consentimiento, para la búsqueda que aceptó. Úsela solo para considerarlo para un empleo, manténgala confidencial y segura, y bórrela cuando ya no la necesite o cuando se lo pidamos porque el candidato lo solicitó.",
    )],
    ["Pago y recargos por mora", p(
      `Las facturas se pagan con tarjeta o transferencia bancaria desde el enlace de la factura, o por transferencia electrónica. Los saldos vencidos pueden generar un recargo del 1.5% mensual (o el máximo legal, si es menor), y podemos pausar sus búsquedas hasta que se paguen. Usted paga los costos razonables de cobranza si una factura pasa a cobranza.` + COUNSEL_ES,
    )],
    ["No es empleo; límites", p(
      `${BRAND.name} no emplea a las personas que usted contrata y no es responsable de su trabajo, su conducta ni de cuánto tiempo permanezcan (más allá de la garantía). No garantizamos que una búsqueda se cubra. En la medida en que la ley lo permita, nuestra responsabilidad total según este contrato se limita a las tarifas que usted pagó por la búsqueda a la que se refiere el reclamo, y ninguna de las partes es responsable por lucro cesante ni daños indirectos.` + COUNSEL_ES,
    )],
    ["Vigencia y disposiciones generales", p(
      "Este contrato cubre cada búsqueda que nos encargue hasta que cualquiera de las partes lo termine por aviso escrito. Las tarifas por contrataciones de candidatos presentados antes de la terminación siguen debiéndose. Los cambios a la tarifa de una búsqueda en particular se hacen por escrito (el correo electrónico es suficiente). Se rige por las leyes de Michigan. Si alguna parte no es exigible, el resto sigue vigente.",
    )],
  ]),
};
