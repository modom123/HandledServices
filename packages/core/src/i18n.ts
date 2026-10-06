/*
 * FILE    : packages/core/src/i18n.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Spanish (español) for the customer path: splash, home, header/footer, service names
 *           and taglines, categories, "when do you need it" and the booking steps. English is the
 *           source; anything not translated falls back to English. The AI concierge answers in
 *           the customer's language on its own.
 * UPDATED : 2026-10-02_1405 UTC — every pricing question, answer, help line and "included" item
 *           (i18n-catalog-es.ts); units; frequencies.
 * UPDATED : 2026-10-02_2246 UTC — waitlist and Google review wording.
 * UPDATED : 2026-10-03_0027 UTC — "Email me this price".
 * UPDATED : 2026-10-04_1934 UTC — new services (small moves, large-item delivery, staging moves, unit turnover) and the Haul Away category renamed.
 * UPDATED : 2026-10-04_1950 UTC — grocery delivery replaced by Same-Day Courier.
 * UPDATED : 2026-10-05_0438 UTC — Event Security.
 * UPDATED : 2026-10-05_1433 UTC — Spanish for the Security category and Security Guards & Patrol.
 * UPDATED : 2026-10-06_0526 UTC — Spanish for Dead Animal Removal.
 */
import type { CategoryId } from "./types.ts";
import { ES_CATALOG } from "./i18n-catalog-es.ts";
import { ES_LINES } from "./i18n-lines-es.ts";
import { ES_PRO_PORTAL } from "./i18n-pro-es.ts";
import { ES_PROS_SIGNUP } from "./i18n-pros-es.ts";

export type Locale = "en" | "es";
export const LOCALES: Locale[] = ["en", "es"];

const ES: Record<string, string> = {
  // header / footer / common
  "Services": "Servicios", "Events": "Eventos", "For Business": "Empresas", "Become a Pro": "Trabaje con nosotros", "My Bookings": "Mis reservas",
  "Sign in": "Iniciar sesión", "Book now": "Reservar", "Company": "Empresa", "Parties & events": "Fiestas y eventos", "Commercial accounts": "Cuentas comerciales",
  "Join as a pro": "Únase como profesional", "Customer reviews": "Opiniones de clientes", "Gift cards": "Tarjetas de regalo",
  // splash / home
  "AI-run operations · real local pros": "Operación con IA · profesionales locales reales",
  "Your home & business to-do list.": "Su lista de pendientes del hogar y el negocio.",
  "Handled.": "Resuelta.",
  "Enter": "Entrar a", "Get my price": "Ver mi precio", "services · one account": "servicios · una sola cuenta",
  "Vetted, insured pros": "Profesionales verificados y asegurados", "Background-checked, licensed where required, and rated on every job.": "Con verificación de antecedentes, licencia cuando se requiere y calificados en cada trabajo.",
  "Upfront, all-in price": "Precio total por adelantado", "Your real price in about a minute. No callbacks, no surprise invoices.": "Su precio real en un minuto. Sin esperas ni facturas sorpresa.",
  "Make-it-right guarantee": "Garantía de satisfacción", "Not right? A free redo or your money back within": "¿No quedó bien? Lo rehacemos gratis o le devolvemos su dinero dentro de",
  "days.": "días.", "For businesses": "Para empresas", "Skip intro": "Saltar introducción",
  "See all": "Ver los", "Browse by category": "Explorar por categoría", "How it works": "Cómo funciona", "from": "desde", "By budget": "Según presupuesto",
  "Get a real price in 60 seconds": "Precio real en 60 segundos", "We send one vetted pro": "Enviamos un profesional verificado", "Track it like a delivery": "Sígalo como un envío",
  "Answer a few questions or snap photos. Our AI checks the details and gives you an upfront price — not a callback.": "Responda unas preguntas o tome fotos. Nuestra IA revisa los detalles y le da un precio por adelantado, sin esperar llamadas.",
  "Insured, background-checked and rated. We pick the best available pro for your job, date and neighborhood.": "Asegurado, verificado y calificado. Elegimos al mejor profesional disponible para su trabajo, fecha y vecindario.",
  "Live status, messages and before/after photos in the app. If it isn’t right, we come back free or refund you.": "Estado en vivo, mensajes y fotos de antes y después. Si no queda bien, volvemos gratis o le devolvemos el dinero.",
  // booking
  "Get your price & book": "Vea su precio y reserve", "Service": "Servicio", "Details": "Detalles", "When & where": "Cuándo y dónde", "Review": "Revisar",
  "Continue": "Continuar", "Back": "Atrás", "Change": "Cambiar", "Your price": "Su precio", "Per visit": "Por visita", "Estimated range": "Rango estimado",
  "When do you need it done?": "¿Para cuándo lo necesita?", "Your budget (optional)": "Su presupuesto (opcional)", "Promo, gift card or referral code": "Código promocional, de regalo o de referido",
  "Apply": "Aplicar", "Due today": "A pagar hoy", "Service ZIP code": "Código postal del servicio", "Street address": "Dirección", "City": "Ciudad", "State": "Estado",
  "Your contact info": "Sus datos de contacto", "Full name": "Nombre completo", "Email": "Correo electrónico", "Mobile": "Celular",
  "Anything we should know?": "¿Algo que debamos saber?", "How often": "Frecuencia", "Home": "Hogar", "Business": "Negocio",
  "Requested": "Solicitado", "Site visit": "Visita al sitio", "Quoted": "Cotizado", "Scheduled": "Programado", "Dispatching": "Buscando profesional",
  "Pro assigned": "Profesional asignado", "In progress": "En curso", "QA review": "Revisión de calidad", "Completed": "Completado", "Cancelled": "Cancelado",
  "Morning (8–11am)": "Mañana (8–11 a. m.)", "Midday (11am–2pm)": "Mediodía (11 a. m.–2 p. m.)", "Afternoon (2–5pm)": "Tarde (2–5 p. m.)", "Any time that day": "Cualquier hora ese día",
  // photo tips, timing hints, promise, Plus perks
  "Kitchen": "Cocina",
  "Bathrooms": "Baños",
  "Main living area": "Sala principal",
  "Front of the home": "Frente de la casa",
  "Back of the home": "Parte trasera de la casa",
  "Each room, wide shot": "Cada cuarto, foto amplia",
  "The worst stains up close": "Las peores manchas de cerca",
  "Any upholstery": "Cualquier tapicería",
  "Each space to organize, wide shot": "Cada espacio a organizar, foto amplia",
  "Inside closets or cabinets": "Dentro de clósets o gabinetes",
  "Roofline from the street": "El techo visto desde la calle",
  "The whole surface, wide shot": "Toda la superficie, foto amplia",
  "The worst stains or mildew up close": "Las peores manchas o moho de cerca",
  "Anything nearby to protect": "Lo que haya cerca que proteger",
  "Front yard": "Patio delantero",
  "Back yard": "Patio trasero",
  "The whole tree": "El árbol completo",
  "Base of the trunk": "La base del tronco",
  "Nearby house, fence or power lines": "Casa, cerca o cables eléctricos cercanos",
  "Driveway and walkways": "Entrada de autos y caminos",
  "The yard": "El patio",
  "Everything that's going, wide shot": "Todo lo que se va, foto amplia",
  "Anything heavy or bulky": "Lo pesado o voluminoso",
  "The path out (stairs, doorways)": "El camino de salida (escaleras, puertas)",
  "Each item": "Cada objeto",
  "Labels showing model or weight on heavy items": "Etiquetas con modelo o peso de los objetos pesados",
  "Where the container goes (driveway or street)": "Dónde va el contenedor (entrada o calle)",
  "Anything overhead (wires, branches)": "Lo que haya arriba (cables, ramas)",
  "Each thing to fix or install": "Cada cosa a reparar o instalar",
  "Close-up of the problem": "El problema de cerca",
  "The leak, clog or fixture": "La fuga, el tapón o la pieza",
  "Under the sink / shut-off valves": "Debajo del fregadero / llaves de paso",
  "The whole water heater": "El calentador de agua completo",
  "Its label (model & gallons)": "Su etiqueta (modelo y galones)",
  "Venting and gas or electric hookup": "Ventilación y conexión de gas o eléctrica",
  "Furnace or air handler": "Calefactor o manejadora de aire",
  "Outdoor unit": "Unidad exterior",
  "Model labels": "Etiquetas del modelo",
  "Where the light goes": "Dónde va la lámpara",
  "Existing fixture or switch": "Lámpara o interruptor actual",
  "Where each camera goes": "Dónde va cada cámara",
  "Your Wi-Fi router": "Su router de Wi-Fi",
  "Under the sink, showing the disposal and pipes": "Debajo del fregadero, mostrando el triturador y la tubería",
  "Each room or area, wide shot": "Cada cuarto o área, foto amplia",
  "Any cracks, holes or water stains": "Grietas, agujeros o manchas de agua",
  "Ceilings and trim if included": "Techos y molduras si se incluyen",
  "Each side of the building": "Cada lado del edificio",
  "Peeling or damaged areas up close": "Áreas peladas o dañadas de cerca",
  "Trim, doors and any deck": "Molduras, puertas y terraza",
  "Each wall of the room": "Cada pared del cuarto",
  "Floor": "Piso",
  "Anything you're keeping": "Lo que va a conservar",
  "Each wall of the kitchen": "Cada pared de la cocina",
  "Floor and ceiling": "Piso y techo",
  "Each area to remodel": "Cada área a remodelar",
  "Floors": "Pisos",
  "Today if a pro is free, or tomorrow. Priority fee applies within 48 hours.": "Hoy si hay un profesional libre, o mañana. Se aplica cargo de prioridad dentro de 48 horas.",
  "Within 7 days": "En 7 días",
  "Within 14 days": "En 14 días",
  "Within 30 days": "En 30 días",
  "Any open date — often the best availability": "Cualquier fecha disponible — suele haber más disponibilidad",
  "Pay upfront to lock in your pro. Not right? Free redo or your money back within 30 days.": "Pague por adelantado para asegurar a su profesional. ¿No quedó bien? Lo rehacemos gratis o le devolvemos su dinero en 30 días.",
  "No priority fees — same-day and next-day at the normal price": "Sin cargos de prioridad — mismo día y día siguiente al precio normal",
  "10% off every job (on top of plan discounts)": "10% de descuento en cada trabajo (además de los descuentos del plan)",
  "Members are offered first for same-day slots": "Los miembros tienen prioridad en horarios del mismo día",
  "Cancel anytime": "Cancele cuando quiera",
  "Fits your budget.": "Está dentro de su presupuesto.",
  // booking form (web)
  "Gate code, pets, parking, what's in the garage, the tree is leaning toward the house…": "Código del portón, mascotas, estacionamiento, qué hay en el garaje, el árbol inclinado hacia la casa…",
  "Photos — recommended": "Fotos — recomendadas",
  "Photos (optional)": "Fotos (opcional)",
  "Our AI checks your photos so the price fits the job — no surprises on the day.": "Nuestra IA revisa sus fotos para que el precio corresponda al trabajo — sin sorpresas ese día.",
  "Event address (or your neighborhood if you need a venue)": "Dirección del evento (o su vecindario si necesita salón)",
  "We text updates about this job only. We never sell your info to other contractors.": "Solo le enviamos mensajes sobre este trabajo. Nunca vendemos sus datos a otros contratistas.",
  "before the job": "antes del trabajo",
  "Pay in full": "Pagar completo",
  "Nothing more to pay.": "Nada más que pagar.",
  "Pay a deposit": "Pagar un depósito",
  "I agree to the": "Acepto el",
  "Service Agreement": "Acuerdo de servicio",
  "the site visit is free; I pay upfront once I approve the firm quote.": "la visita es gratis; pago por adelantado cuando apruebe la cotización final.",
  "I pay upfront; you pay the pro after the job is done and checked; free redo or refund if it’s not right.": "pago por adelantado; ustedes pagan al profesional cuando el trabajo está hecho y revisado; se rehace gratis o se reembolsa si no queda bien.",
  "Checking your photos…": "Revisando sus fotos…",
  "Booking…": "Reservando…",
  "Finalizing your price…": "Finalizando su precio…",
  "Book free site visit": "Reservar visita gratuita",
  "Pay": "Pagar",
  "Your budget — how we’d spend it": "Su presupuesto — cómo lo usaríamos",
  "What you’d like to spend": "Lo que le gustaría gastar",
  "(already at our lowest price for this job)": "(ya está en nuestro precio más bajo para este trabajo)",
  "Plus member saving": "Ahorro de miembro Plus",
  "Code": "Código",
  "Gift card": "Tarjeta de regalo",
  "Checking your photos and notes so the price fits the job…": "Revisando sus fotos y notas para que el precio corresponda al trabajo…",
  "Updated from your photos": "Actualizado según sus fotos",
  "Not right? Change your answers above.": "¿No es correcto? Cambie sus respuestas arriba.",
  "a pro visits free to give you a firm quote. Nothing is charged until you approve it.": "un profesional lo visita gratis para darle una cotización final. No se cobra nada hasta que la apruebe.",
  "That code isn't valid.": "Ese código no es válido.",
  "That code has expired.": "Ese código expiró.",
  "That code has been used up.": "Ese código ya se agotó.",
  "That code is for first-time customers.": "Ese código es para clientes nuevos.",
  "That gift card has no balance left.": "Esa tarjeta de regalo no tiene saldo.",
  // concierge + sidebar
  "Hi! What can we take off your plate? Tell me the job and I’ll give you a price.": "¡Hola! ¿Qué pendiente le quitamos de encima? Cuénteme el trabajo y le doy un precio.",
  "Sorry, I couldn’t reach the server.": "Lo sentimos, no pudimos conectar con el servidor.",
  "Concierge": "Asistente",
  "AI · instant prices · 24/7": "IA · precios al instante · 24/7",
  "e.g. haul away an old couch": "p. ej. llevarse un sofá viejo",
  "Send": "Enviar",
  "Ask for a price": "Pida un precio",
  "CODE": "CÓDIGO",
  "Our AI checks your photos and notes before you pay.": "Nuestra IA revisa sus fotos y notas antes de que pague.",
  "Free planning call first. Your planner sends a firm plan at or under this budget; you pay once you approve it.": "Primero una llamada de planificación gratis. Su planificador le envía un plan final dentro de este presupuesto; paga cuando lo apruebe.",
  "Free site visit — a pro confirms the firm price, then you pay to lock in the work.": "Visita gratuita — un profesional confirma el precio final y luego paga para asegurar el trabajo.",
  // account pages, messages, photos
  "Messages": "Mensajes",
  "No messages yet.": "Aún no hay mensajes.",
  "customer": "cliente",
  "pro": "profesional",
  "ops": "soporte",
  "Write a message…": "Escriba un mensaje…",
  "Thanks for the review!": "¡Gracias por su opinión!",
  "How did we do?": "¿Qué tal lo hicimos?",
  "Optional comment": "Comentario opcional",
  "Submit review": "Enviar opinión",
  "to lock in your pro": "para asegurar a su profesional",
  "We dispatch as soon as it’s paid. Not right? Free redo or your money back within 30 days.": "Enviamos al profesional en cuanto se paga. ¿No quedó bien? Lo rehacemos gratis o le devolvemos su dinero en 30 días.",
  "Couldn’t start payment": "No se pudo iniciar el pago",
  "Pay now": "Pagar ahora",
  "Cancel this booking": "Cancelar esta reserva",
  "Cancel this booking?": "¿Cancelar esta reserva?",
  "Nothing has been charged.": "No se ha cobrado nada.",
  "You’re more than 24 hours out — you’ll get a full refund to your card.": "Faltan más de 24 horas — recibirá el reembolso completo en su tarjeta.",
  "Couldn’t cancel": "No se pudo cancelar",
  "Yes, cancel": "Sí, cancelar",
  "Keep it": "Conservarla",
  "Add photos for your pro": "Agregue fotos para su profesional",
  "More angles, a close-up, the spot you’re worried about.": "Más ángulos, un acercamiento, el lugar que le preocupa.",
  "on file.": "guardadas.",
  "Couldn’t add photos": "No se pudieron agregar las fotos",
  "Saving…": "Guardando…",
  "Upload failed — try again": "No se pudo subir — intente de nuevo",
  "Take photo": "Tomar foto",
  "Choose from library": "Elegir de la galería",
  "Choose photos": "Elegir fotos",
  "added": "agregadas",
  "or drag & drop, or paste (Ctrl/⌘+V)": "o arrastre y suelte, o pegue (Ctrl/⌘+V)",
  "Your photo": "Su foto",
  "photo": "foto",
  "Remove photo": "Quitar foto",
  "Copied ✓": "Copiado ✓",
  "Copy my link": "Copiar mi enlace",
  "Try again": "Intente de nuevo",
  "One moment…": "Un momento…",
  "Manage or cancel": "Administrar o cancelar",
  "Join Plus": "Unirse a Plus",
  "Tip your pro": "Dé propina a su profesional",
  "100% goes to your pro.": "El 100% es para su profesional.",
  "Other $": "Otro $",
  "Tip": "Dar propina",
  "Delete my account": "Eliminar mi cuenta",
  "Delete your account?": "¿Eliminar su cuenta?",
  "This removes your login, profile, phone, saved devices and photos, and cancels any membership. We keep invoices and payment records (name and email only) because tax law requires it. This can’t be undone.": "Esto elimina su acceso, perfil, teléfono, dispositivos guardados y fotos, y cancela cualquier membresía. Conservamos facturas y registros de pago (solo nombre y correo) porque la ley fiscal lo exige. No se puede deshacer.",
  "Type DELETE": "Escriba DELETE",
  "Couldn't delete — contact support": "No se pudo eliminar — comuníquese con soporte",
  "Deleting…": "Eliminando…",
  "Delete permanently": "Eliminar definitivamente",
  "Keep my account": "Conservar mi cuenta",
  "Your pro has arrived and started work.": "Su profesional llegó y comenzó el trabajo.",
  "Your pro": "Su profesional",
  "Live location appears when their phone shares it.": "La ubicación en vivo aparece cuando su teléfono la comparte.",
  "Your pro's location": "Ubicación de su profesional",
  "Reschedule": "Cambiar fecha",
  "Pick a new day and time": "Elija un nuevo día y horario",
  "Couldn't move it": "No se pudo cambiar",
  "Moving…": "Cambiando…",
  "Move my booking": "Cambiar mi reserva",
  "Keep current time": "Mantener horario actual",
  "Free until 24 hours before. If your pro isn’t free at the new time, we’ll match another vetted pro.": "Gratis hasta 24 horas antes. Si su profesional no está libre en el nuevo horario, le asignamos otro profesional verificado.",
  "My bookings": "Mis reservas",
  "Book a service": "Reservar un servicio",
  "Sign out": "Cerrar sesión",
  "Next visit": "Próxima visita",
  "weekly": "semanal",
  "biweekly": "quincenal",
  "monthly": "mensual",
  "quarterly": "trimestral",
  "once": "una vez",
  "you're a member": "usted es miembro",
  "month": "mes",
  "Invoice & service agreement": "Factura y acuerdo de servicio",
  "Paid": "Pagado",
  "Your photos": "Sus fotos",
  "Completion photos": "Fotos del trabajo terminado",
  "Completed work": "Trabajo terminado",
  "Timeline": "Historial",
  "hrs": "h", "sq ft": "pies²", "Yes": "Sí", "No": "No",
  "One time": "Una vez", "Weekly (save 20%)": "Semanal (ahorre 20%)", "Every 2 weeks (save 15%)": "Cada 2 semanas (ahorre 15%)", "Monthly (save 10%)": "Mensual (ahorre 10%)", "Quarterly (save 5%)": "Trimestral (ahorre 5%)", "Weekly": "Semanal", "Every 2 weeks": "Cada 2 semanas", "Monthly": "Mensual", "Quarterly": "Trimestral",
  "As soon as possible": "Lo antes posible", "This week": "Esta semana", "Within 2 weeks": "En 2 semanas", "Within a month": "En un mes", "I'm flexible": "Tengo flexibilidad",
  // waitlist & Google reviews
  "Rather wait for a confirmed pro?": "¿Prefiere esperar a un profesional confirmado?",
  "Mobile (optional, for a text)": "Celular (opcional, para un mensaje de texto)",
  "Notify me": "Avisarme",
  "Enter a valid email and 5-digit ZIP": "Ingrese un correo válido y un código postal de 5 dígitos",
  "Couldn't save — try again": "No se pudo guardar — intente de nuevo",
  "Not available right now": "No está disponible en este momento",
  "Too many requests — please wait a few minutes and try again.": "Demasiadas solicitudes — espere unos minutos e intente de nuevo.",
  "Would you share your experience on Google too? It’s how neighbors find good pros.": "¿Compartiría su experiencia en Google también? Así es como los vecinos encuentran buenos profesionales.",
  "Review us on Google": "Déjenos una reseña en Google",
  "Not now": "Ahora no",
  "Not ready? Email me this price": "¿No está listo? Envíeme este precio por correo",
  "Sent — check your inbox. Your answers are saved in the link.": "Enviado — revise su correo. Sus respuestas quedan guardadas en el enlace.",
  "We’ll email the price and a reminder or two. Unsubscribe anytime.": "Le enviaremos el precio y uno o dos recordatorios. Puede cancelar la suscripción cuando quiera.",
  "Enter a valid email": "Ingrese un correo válido",
  "My contracts": "Mis contratos",
  "Name your price": "Ponga su precio",
  "Use suggested": "Usar el sugerido",
  "Lower offers can take longer to get a pro — we'll let you know if no one takes it.": "Las ofertas más bajas pueden tardar más en conseguir un profesional — le avisaremos si nadie lo toma.",
  "A higher offer usually gets a pro faster.": "Una oferta más alta suele conseguir un profesional más rápido.",
  "Raise your offer": "Suba su oferta",
  "Enter a higher price than you're paying now": "Ingrese un precio mayor al que paga ahora",
  "A pro already took this job": "Un profesional ya tomó este trabajo",
  "That counter is no longer available": "Esa contraoferta ya no está disponible",
  "Pay for the booking first": "Primero pague la reserva",
  "Your signature also covers:": "Su firma también cubre:",
  "Each one starts with a short plain-English version. Copies of everything you sign are saved in My contracts.": "Cada uno empieza con una versión corta en lenguaje sencillo (en inglés). Las copias de todo lo que firme se guardan en Mis contratos.",
  "I have read and agree to the Independent Contractor Agreement and the documents listed above.": "He leído y acepto el Acuerdo de Contratista Independiente y los documentos indicados arriba.",
  "My account": "Mi cuenta",
  "Every agreement you accepted, with the exact text as it was when you agreed. Print or save any of them as a PDF.": "Cada acuerdo que aceptó, con el texto exacto tal como estaba cuando lo aceptó. Puede imprimir o guardar cualquiera como PDF.",
  "The legal text of our agreements is in English. If you have questions, write to us.": "El texto legal de nuestros acuerdos está en inglés. Si tiene preguntas, escríbanos.",
  "Nothing yet — the agreements for each booking will appear here.": "Todavía nada: aquí aparecerán los acuerdos de cada reserva.",
  "Recruiting (Handled Talent)": "Reclutamiento (Handled Talent)",
  "See all current terms & agreements": "Ver todos los términos y acuerdos vigentes",
  "Every agreement you signed, with the exact text as it was when you signed.": "Cada acuerdo que firmó, con el texto exacto tal como estaba cuando lo firmó.",
  "Nothing yet — sign your agreement in setup and your copies will appear here.": "Todavía nada: firme su acuerdo en la configuración y sus copias aparecerán aquí.",
  "Sorry it wasn’t great — our team will reach out to make it right.": "Lamentamos que no haya salido bien — nuestro equipo se comunicará para solucionarlo.",
};

const ES_CATEGORY: Record<CategoryId, { name: string; short: string; blurb: string }> = {
  cleaning: { name: "Limpieza y organización", short: "Limpieza", blurb: "Casas, oficinas, ventanas, alfombras, canaletas, lavado a presión, lavado de autos a domicilio y organización." },
  outdoor: { name: "Jardín, hojas y nieve", short: "Jardín y nieve", blurb: "Corte de césped, limpieza de hojas, remoción de nieve y árboles." },
  pets: { name: "Mascotas", short: "Mascotas", blurb: "Paseo y cuidado de perros, y limpieza del patio, con personal verificado." },
  removal: { name: "Retiro, mudanzas y entregas", short: "Retiro y mudanza", blurb: "Basura fuera hoy mismo, mudanzas pequeñas, entrega de objetos grandes el mismo día, muebles de decoración, retiro de animales muertos, o un contenedor por una semana." },
  repair_remodel: { name: "Reparaciones, pintura y remodelación", short: "Reparaciones", blurb: "Mantenimiento, plomería, electricidad, climatización, calentadores, pintura interior y exterior, y remodelaciones." },
  errands: { name: "Mandados y entregas", short: "Mandados", blurb: "Mensajería el mismo día, entregas médicas, tintorería, devoluciones y entregas, o un asistente por el día." },
  transport: { name: "Transporte", short: "Transporte", blurb: "Choferes privados, autos ejecutivos, aeropuerto, partidos y conciertos, limusinas, autobuses de fiesta y de turismo, y lanzaderas." },
  events: { name: "Fiestas y eventos", short: "Eventos", blurb: "Planificación, comida, food trucks, DJ, alquileres, salones y seguridad, en una sola factura." },
  security: { name: "Guardias de seguridad y patrullaje", short: "Seguridad", blurb: "Guardias con licencia para edificios, obras, estacionamientos y eventos: puestos fijos, rondas nocturnas y vigilancia contra incendios." },
};

const ES_SERVICE: Record<string, [string, string]> = {
  "house-cleaning": ["Limpieza de casas y oficinas", "Personal verificado, el mismo equipo en cada visita."],
  "window-cleaning": ["Limpieza de ventanas", "Vidrios sin rayas, mosquiteros y rieles."],
  "carpet-cleaning": ["Limpieza de alfombras y tapicería", "Extracción con agua caliente, seca en horas."],
  "organizing": ["Organización y orden", "De clósets a garajes: ordenado, etiquetado y donado."],
  "gutter-cleaning": ["Limpieza de canaletas", "Despejadas, enjuagadas y con fotos de prueba."],
  "power-washing": ["Lavado a presión", "Entradas, fachadas, sótanos y terrazas como nuevos."],
  "mobile-car-detailing": ["Lavado y detallado de autos a domicilio", "Su auto impecable en su entrada o en el estacionamiento de la oficina."],
  "lawn-care": ["Cuidado del césped", "Corte, bordes y soplado, en automático."],
  "tree-removal": ["Poda y remoción de árboles", "Arbolistas asegurados. Estimado gratis en sitio."],
  "leaf-removal": ["Limpieza de hojas", "Rastrilladas, sopladas, embolsadas y retiradas."],
  "snow-removal": ["Remoción de nieve", "Entradas, aceras y estacionamientos: una tormenta o toda la temporada."],
  "dog-walking": ["Paseo de perros", "El mismo paseador en cada paseo, con fotos y GPS."],
  "dog-sitting": ["Cuidado de perros y mascotas", "Visitas, cuidado de día o estadías nocturnas en su casa."],
  "pet-waste-removal": ["Limpieza de desechos de perro", "Un patio limpio cada semana. Portón cerrado, garantizado."],
  "dead-animal-removal": ["Retiro de animales muertos", "Se retira hoy: embolsado, retirado y desechado correctamente. Tratamiento de olores disponible."],
  "junk-removal": ["Retiro de basura", "Precio según la cantidad; nosotros cargamos todo. Donamos y reciclamos primero."],
  "large-item-removal": ["Retiro de objetos grandes", "Precio según cuántos y cuánto pesan: de sofás a pianos."],
  "small-moves": ["Mudanzas pequeñas y ayuda para mudarse", "Mudanceros por hora, con o sin camión: departamentos, casas pequeñas o un solo cuarto."],
  "retail-delivery": ["Entrega de objetos grandes el mismo día", "Muebles y electrodomésticos entregados hoy, para tiendas, vendedores y compradores."],
  "staging-transport": ["Mudanza de muebles para decoración de casas en venta", "Muebles de decoración entregados, colocados y recogidos después de la venta, para decoradores y agentes."],
  "unit-turnover": ["Preparación de unidades de renta", "Retiro, limpieza profunda, retoques y lista de arreglos: lista para rentar en una sola reserva."],
  "junk-container": ["Contenedor de basura (entrega y retiro)", "Dejamos un contenedor, usted lo llena en una semana y lo retiramos."],
  "handyman": ["Mantenimiento general", "Su lista de pendientes, resuelta en una visita."],
  "plumbing": ["Reparaciones de plomería", "Tapones, fugas, inodoros y llaves: arreglados hoy."],
  "water-heater": ["Calentadores de agua: cambio y reparación", "Tanque nuevo, solo instalación o reparación, con plomeros con licencia."],
  "hvac-install": ["Instalación de aire y calefacción", "Aire acondicionado, calefacción, bomba de calor y minisplits; cotización gratis."],
  "lighting-install": ["Instalación de lámparas y ventiladores", "Lámparas, ventiladores de techo, luces empotradas y exteriores."],
  "camera-install": ["Instalación de cámaras de seguridad", "Timbres, cámaras Wi-Fi y cableadas, listas en su teléfono."],
  "garbage-disposal": ["Triturador de basura", "Destrabar, reparar o cambiar por uno nuevo."],
  "interior-painting": ["Pintura interior", "Un cuarto, varias áreas o toda la casa u oficina."],
  "exterior-painting": ["Pintura exterior", "Casas y edificios: fachada, molduras, puertas y terrazas."],
  "bathroom-remodel": ["Remodelación de baño", "Del diseño a la entrega, con un solo encargado."],
  "kitchen-remodel": ["Remodelación de cocina", "Gabinetes, encimeras y distribución, con precio cerrado."],
  "home-remodel": ["Remodelación de casa completa", "Sótanos, ampliaciones y renovaciones completas."],
  "errands": ["Mandados y recogidas", "Tintorería, devoluciones, recogidas y entregas: hecho."],
  "courier": ["Mensajería el mismo día", "Documentos, paquetes y piezas al otro lado de la ciudad hoy, con foto como comprobante."],
  "medical-delivery": ["Entregas médicas", "Recetas, insumos y muestras de laboratorio, con cuidado y firma."],
  "personal-assistant": ["Asistente personal por el día", "Una mano extra por unas horas o todo el día."],
  "private-driver": ["Chofer privado / auto ejecutivo", "Un chofer profesional por hora: reuniones, salidas o un día de mandados."],
  "airport-transfer": ["Traslado al aeropuerto", "Tarifa fija de ida y vuelta, con seguimiento del vuelo."],
  "limousine": ["Limusina", "Limusinas para bodas, graduaciones y noches especiales."],
  "party-bus": ["Autobús de fiesta", "Luces, sonido y espacio para 20 a 40 invitados."],
  "charter-bus": ["Autobús de turismo y alquiler", "Minibuses y autobuses por día: paseos, equipos y grupos."],
  "game-day-rides": ["Transporte a partidos y conciertos", "De la puerta a la entrada del estadio; su chofer espera y los trae de vuelta."],
  "event-shuttle": ["Lanzadera corporativa y de eventos", "Recorridos entre hoteles, oficinas, estacionamientos y su evento."],
  "event-package": ["Planear mi evento (por presupuesto)", "Denos un presupuesto y el número de invitados; planeamos y reservamos todo."],
  "event-planning": ["Planificación y coordinación de eventos", "Un planificador, todos los proveedores, una factura."],
  "catering": ["Servicio de comida", "De bocadillos a cenas servidas, con personal."],
  "food-truck": ["Reserva de food truck", "Tacos, barbacoa, pizza, hamburguesas o postres en su fiesta."],
  "dj-music": ["DJ y música en vivo", "DJ, animadores, bandas y dúos acústicos."],
  "security-guard": ["Guardias de seguridad y patrullaje", "Guardias con licencia para su edificio, obra o estacionamiento: puesto fijo, rondas nocturnas o vigilancia contra incendios."],
  "event-security": ["Seguridad para eventos", "Seguridad uniformada y con licencia para fiestas, salones y eventos."],
  "event-rentals": ["Alquiler de sillas y fiestas", "Sillas, mesas, manteles, carpas y pistas de baile, entregadas e instaladas."],
  "event-venue": ["Alquiler y coordinación de salones", "Buscamos, visitamos y reservamos el salón ideal para sus invitados."],
};

/** Translate a UI string (English is the key). */
export function t(locale: Locale | string | null | undefined, en: string): string {
  return locale === "es" ? ES[en] ?? ES_CATALOG[en] ?? ES_PRO_PORTAL[en] ?? ES_PROS_SIGNUP[en] ?? en : en;
}

export function serviceText(locale: Locale | string | null | undefined, slug: string, en: { name: string; tagline: string }) {
  const es = locale === "es" ? ES_SERVICE[slug] : undefined;
  return es ? { name: es[0], tagline: es[1] } : { name: en.name, tagline: en.tagline };
}

export function categoryText(locale: Locale | string | null | undefined, id: CategoryId, en: { name: string; short: string; blurb: string }) {
  return locale === "es" ? ES_CATEGORY[id] ?? en : en;
}

/** Every service has a Spanish name and tagline (checked by tests). */
export const ES_SERVICE_SLUGS = Object.keys(ES_SERVICE);

/** Budget vs price message in the visitor's language (see budgetFit in timing.ts). */
export function budgetMessage(locale: Locale | string | null | undefined, fit: { status: string; gap: number }, budget: number): string {
  if (locale !== "es" || fit.status === "none") return "";
  const f = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  if (fit.status === "fits") return "Está dentro de su presupuesto.";
  if (fit.status === "close") return `${f(fit.gap)} por encima de su presupuesto. Una fecha flexible (sin cargo de prioridad) o un alcance un poco menor suele cerrar la diferencia.`;
  return `${f(fit.gap)} por encima de su presupuesto de ${f(budget)}. Pruebe un alcance menor, un plan recurrente, o envíela de todos modos — le llamaremos con opciones.`;
}

const NUM = /\$?\d[\d,]*(?:\.\d+)?/g;

/** Price-breakdown line in the visitor's language: numbers and amounts are kept, the words are translated. */
export function lineText(locale: Locale | string | null | undefined, label: string): string {
  if (locale !== "es") return label;
  const nums = label.match(NUM) ?? [];
  const tpl = ES_LINES[label.replace(NUM, "{#}")];
  if (!tpl) return ES[label] ?? ES_CATALOG[label] ?? label;
  let i = 0;
  return tpl.replace(/\{#\}/g, () => nums[i++] ?? "");
}
