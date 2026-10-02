/*
 * FILE    : packages/core/src/i18n.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Spanish (español) for the customer path: splash, home, header/footer, service names
 *           and taglines, categories, "when do you need it" and the booking steps. English is the
 *           source; anything not translated falls back to English. The AI concierge answers in
 *           the customer's language on its own.
 */
import type { CategoryId } from "./types.ts";

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
  "As soon as possible": "Lo antes posible", "This week": "Esta semana", "Within 2 weeks": "En 2 semanas", "Within a month": "En un mes", "I'm flexible": "Tengo flexibilidad",
};

const ES_CATEGORY: Record<CategoryId, { name: string; short: string; blurb: string }> = {
  cleaning: { name: "Limpieza y organización", short: "Limpieza", blurb: "Casas, oficinas, ventanas, alfombras, canaletas, lavado a presión, lavado de autos a domicilio y organización." },
  outdoor: { name: "Jardín, hojas y nieve", short: "Jardín y nieve", blurb: "Corte de césped, limpieza de hojas, remoción de nieve y árboles." },
  pets: { name: "Mascotas", short: "Mascotas", blurb: "Paseo y cuidado de perros, y limpieza del patio, con personal verificado." },
  removal: { name: "Retiro de cosas", short: "Retiro", blurb: "Basura, muebles y objetos pesados hoy mismo, o un contenedor por una semana." },
  repair_remodel: { name: "Reparaciones, pintura y remodelación", short: "Reparaciones", blurb: "Mantenimiento, plomería, electricidad, climatización, calentadores, pintura interior y exterior, y remodelaciones." },
  errands: { name: "Mandados y entregas", short: "Mandados", blurb: "Entrega de víveres, entregas médicas, tintorería, devoluciones, o un asistente por el día." },
  transport: { name: "Transporte", short: "Transporte", blurb: "Choferes privados, autos ejecutivos, aeropuerto, partidos y conciertos, limusinas, autobuses de fiesta y de turismo, y lanzaderas." },
  events: { name: "Fiestas y eventos", short: "Eventos", blurb: "Planificación, comida, food trucks, DJ, alquileres y salones, en una sola factura." },
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
  "junk-removal": ["Retiro de basura", "Precio según la cantidad; nosotros cargamos todo. Donamos y reciclamos primero."],
  "large-item-removal": ["Retiro de objetos grandes", "Precio según cuántos y cuánto pesan: de sofás a pianos."],
  "junk-container": ["Contenedor de basura (entrega y retiro)", "Dejamos un contenedor, usted lo llena en una semana y lo retiramos."],
  "handyman": ["Mantenimiento general", "Su lista de pendientes, resuelta en una visita."],
  "plumbing": ["Reparaciones de plomería", "Tapones, fugas, inodoros y llaves: arreglados hoy."],
  "water-heater": ["Cambio de calentador de agua", "Tanque nuevo o sin tanque, instalado y el viejo retirado."],
  "hvac-install": ["Instalación de aire y calefacción", "Aire acondicionado, calefacción, bomba de calor y minisplits; cotización gratis."],
  "lighting-install": ["Instalación de lámparas y ventiladores", "Lámparas, ventiladores de techo, luces empotradas y exteriores."],
  "camera-install": ["Instalación de cámaras de seguridad", "Timbres, cámaras Wi-Fi y cableadas, listas en su teléfono."],
  "garbage-disposal": ["Triturador de basura", "Destrabar, reparar o cambiar por uno nuevo."],
  "interior-painting": ["Pintura interior", "Un cuarto, varias áreas o toda la casa u oficina."],
  "exterior-painting": ["Pintura exterior", "Casas y edificios: fachada, molduras, puertas y terrazas."],
  "bathroom-remodel": ["Remodelación de baño", "Del diseño a la entrega, con un solo encargado."],
  "kitchen-remodel": ["Remodelación de cocina", "Gabinetes, encimeras y distribución, con precio cerrado."],
  "home-remodel": ["Remodelación de casa completa", "Sótanos, ampliaciones y renovaciones completas."],
  "errands": ["Mandados y recogidas", "Tintorería, víveres, devoluciones y entregas: hecho."],
  "grocery-delivery": ["Compra y entrega de víveres", "Su lista, su tienda, a su puerta; víveres al precio del recibo."],
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
  "event-rentals": ["Alquiler de sillas y fiestas", "Sillas, mesas, manteles, carpas y pistas de baile, entregadas e instaladas."],
  "event-venue": ["Alquiler y coordinación de salones", "Buscamos, visitamos y reservamos el salón ideal para sus invitados."],
};

/** Translate a UI string (English is the key). */
export function t(locale: Locale | string | null | undefined, en: string): string {
  return locale === "es" ? ES[en] ?? en : en;
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
