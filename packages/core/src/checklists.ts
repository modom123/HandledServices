/*
 * FILE    : packages/core/src/checklists.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_0221 UTC
 * PURPOSE : Job checklists — one format for every service, so every job of a kind is delivered the same way.
 *             CHECKLISTS        — a template per service (English + Spanish). Items switch on from the booking
 *                                 answers: a standard clean, a deep clean and a move-out clean are one template
 *                                 whose extra items appear for "deep" / "move"; pets, inside fridge & oven, screens…
 *             resolveChecklist  — template + answers → the job's checklist (stable item ids), with the
 *                                 "Special instructions" section on top: staff instructions, access notes, the
 *                                 customer's notes and requests, each its own line
 *             checklistProgress — done / N/A / left, and which required items are still open
 *           Items describe the RESULT the customer paid for (what "done" looks like), never how a pro must work:
 *           pros are independent businesses and choose their own methods, tools and order. A required item can
 *           be marked N/A with a reason (e.g. "no oven in unit"); the job can't be submitted while one is open.
 *           Services without their own template get one built from what the service includes.
 * UPDATED : 2026-10-05_1433 UTC — Security Guards & Patrol checklist (post, patrol, fire watch).
 * UPDATED : 2026-10-06_0526 UTC — Dead Animal Removal checklist.
 */
import { getService } from "./services.ts";
import { serviceText, t as tr } from "./i18n.ts";

type Val = string | number | boolean;
/** Show when the answer equals / is one of / is greater than. */
export interface ChecklistCond { q: string; in?: Val[]; gt?: number; not?: boolean }
export interface ChecklistItemDef { id: string; en: string; es: string; required?: boolean; photo?: boolean; when?: ChecklistCond }
export interface ChecklistSectionDef { id: string; en: string; es: string; when?: ChecklistCond; items: ChecklistItemDef[] }
export interface ChecklistTemplate {
  service: string;
  version: number;
  title: { en: string; es: string };
  /** Title by an answer (e.g. level: deep → "Deep clean checklist"). */
  titleBy?: { q: string; map: Record<string, { en: string; es: string }> };
  sections: ChecklistSectionDef[];
}

const i = (id: string, en: string, es: string, o: Omit<ChecklistItemDef, "id" | "en" | "es"> = {}): ChecklistItemDef => ({ id, en, es, ...o });
const DEEP = { q: "level", in: ["deep", "move"] };
const MOVE = { q: "level", in: ["move"] };

/** Every job starts and ends the same way. */
const START: ChecklistSectionDef = { id: "start", en: "Start", es: "Inicio", items: [
  i("scope", "Scope confirmed with the customer (or the written instructions if they're not home)", "Alcance confirmado con el cliente (o con las instrucciones escritas si no está)", { required: true }),
  i("before", "Before photos of every area in scope", "Fotos de antes de cada área del trabajo", { required: true, photo: true }),
] };
const FINISH: ChecklistSectionDef = { id: "finish", en: "Finish", es: "Final", items: [
  i("after", "After photos of every area, from the same angles as the before photos", "Fotos de después de cada área, desde los mismos ángulos que las de antes", { required: true, photo: true }),
  i("tidy", "Work area left clean; your supplies, debris and trash removed", "Área de trabajo limpia; sus materiales, escombros y basura retirados", { required: true }),
  i("secure", "Home or site left as found: doors locked, gates closed, lights and thermostat as they were", "Casa o lugar como se encontró: puertas cerradas con llave, portones cerrados, luces y termostato como estaban"),
  i("walk", "Final walkthrough with the customer, or a note in the app if they're away", "Recorrido final con el cliente, o una nota en la app si no está"),
] };
const tpl = (t: Omit<ChecklistTemplate, "sections"> & { sections: ChecklistSectionDef[] }): ChecklistTemplate => ({ ...t, sections: [START, ...t.sections, FINISH] });

/** Start / finish for work that isn't on a home or site: pet visits, errands, rides, events. */
const FRAMES: Record<string, [ChecklistSectionDef, ChecklistSectionDef]> = {
  pets: [
    { id: "start", en: "Arrival", es: "Llegada", items: [
      i("entry", "Entered as the customer instructed (key, code or lockbox); pets and home checked", "Entrada según las instrucciones del cliente (llave, código o caja de seguridad); mascotas y casa revisadas", { required: true }),
    ] },
    { id: "finish", en: "Wrap-up", es: "Cierre", items: [
      i("update", "Photo and note sent to the customer (food, water, potty, behavior)", "Foto y nota enviadas al cliente (comida, agua, necesidades, comportamiento)", { required: true, photo: true }),
      i("secure", "Pets secured; doors locked and key returned as instructed", "Mascotas aseguradas; puertas cerradas y llave devuelta según las instrucciones", { required: true }),
    ] },
  ],
  errands: [
    { id: "start", en: "Start", es: "Inicio", items: [
      i("list", "Task list or pickup details confirmed with the customer", "Lista de tareas o datos de recolección confirmados con el cliente", { required: true }),
    ] },
    { id: "finish", en: "Finish", es: "Final", items: [
      i("proof", "Photo proof at every pickup, stop and drop-off", "Foto de comprobante en cada recolección, parada y entrega", { required: true, photo: true }),
      i("receipts", "Receipts uploaded for every purchase", "Recibos subidos de cada compra"),
      i("done", "Customer told everything is done (or what couldn't be done and why)", "Cliente informado de que todo está hecho (o qué no se pudo y por qué)", { required: true }),
    ] },
  ],
  transport: [
    { id: "start", en: "Before pickup", es: "Antes de recoger", items: [
      i("vehicle", "Vehicle clean, inspected and stocked as booked", "Vehículo limpio, revisado y equipado según lo reservado", { required: true }),
      i("ontime", "At the pickup point on time; customer messaged if anything changes", "En el punto de recolección a tiempo; mensaje al cliente si algo cambia", { required: true }),
    ] },
    { id: "finish", en: "After drop-off", es: "Después de dejar", items: [
      i("dropped", "Every passenger dropped at the booked destination", "Cada pasajero dejado en el destino reservado", { required: true }),
      i("left", "Vehicle checked for left-behind items", "Vehículo revisado por objetos olvidados", { required: true }),
    ] },
  ],
  events: [
    { id: "start", en: "Setup", es: "Montaje", items: [
      i("contact", "Checked in with the on-site contact; timeline confirmed", "Registro con el contacto en el lugar; horario confirmado", { required: true }),
      i("ready", "Set up and ready before the start time", "Montado y listo antes de la hora de inicio", { required: true, photo: true }),
    ] },
    { id: "finish", en: "Teardown", es: "Desmontaje", items: [
      i("teardown", "Equipment packed up; area left as found", "Equipo recogido; área como se encontró", { required: true, photo: true }),
      i("signoff", "Wrap-up with the on-site contact", "Cierre con el contacto en el lugar"),
    ] },
  ],
};

export const CHECKLISTS: Record<string, ChecklistTemplate> = {
  "house-cleaning": tpl({
    service: "house-cleaning", version: 1,
    title: { en: "Cleaning checklist", es: "Lista de limpieza" },
    titleBy: { q: "level", map: { standard: { en: "Standard clean checklist", es: "Lista de limpieza estándar" }, deep: { en: "Deep clean checklist", es: "Lista de limpieza profunda" }, move: { en: "Move-in / move-out clean checklist", es: "Lista de limpieza de mudanza" } } },
    sections: [
      { id: "kitchen", en: "Kitchen", es: "Cocina", items: [
        i("counters", "Counters and backsplash wiped and sanitized", "Encimeras y salpicadero limpios y desinfectados", { required: true }),
        i("sink", "Sink and faucet clean and shining", "Fregadero y llave limpios y brillantes", { required: true }),
        i("stove", "Stovetop, knobs and range-hood front clean", "Estufa, perillas y frente de la campana limpios", { required: true }),
        i("appliances", "Outside of fridge, dishwasher and microwave wiped", "Exterior del refrigerador, lavavajillas y microondas limpio"),
        i("microwave", "Inside of microwave clean", "Interior del microondas limpio"),
        i("fronts", "Cabinet fronts and handles spot-cleaned", "Frentes y jaladores de gabinetes sin manchas", { when: { q: "level", in: ["standard"] } }),
        i("fronts_all", "All cabinet fronts and handles wiped", "Todos los frentes y jaladores de gabinetes limpios", { when: DEEP }),
        i("inside_cabinets", "Inside of every cabinet and drawer wiped (empty home)", "Interior de cada gabinete y cajón limpio (casa vacía)", { when: MOVE, required: true }),
        i("fridge", "Inside of fridge: shelves, drawers and door bins", "Interior del refrigerador: repisas, cajones y puertas", { when: { q: "fridge_oven", in: [true] }, required: true }),
        i("fridge_move", "Inside of fridge: shelves, drawers and door bins", "Interior del refrigerador: repisas, cajones y puertas", { when: MOVE, required: true }),
        i("oven", "Inside of oven, racks and door glass", "Interior del horno, parrillas y vidrio de la puerta", { when: { q: "fridge_oven", in: [true] }, required: true }),
        i("oven_move", "Inside of oven, racks and door glass", "Interior del horno, parrillas y vidrio de la puerta", { when: MOVE, required: true }),
        i("table", "Table and chairs wiped", "Mesa y sillas limpias"),
        i("floor", "Floor vacuumed and mopped, including corners", "Piso aspirado y trapeado, incluidas las esquinas", { required: true }),
        i("trash", "Trash and recycling emptied, fresh liners", "Basura y reciclaje vaciados, bolsas nuevas"),
      ] },
      { id: "bath", en: "Bathrooms", es: "Baños", items: [
        i("toilet", "Toilet clean inside, outside, base and behind", "Inodoro limpio por dentro, por fuera, la base y detrás", { required: true }),
        i("shower", "Tub and shower clean, soap scum removed", "Tina y regadera limpias, sin residuos de jabón", { required: true }),
        i("glass", "Shower doors and tracks descaled", "Puertas y rieles de la regadera sin sarro", { when: DEEP }),
        i("grout", "Tile grout scrubbed", "Juntas de azulejo talladas", { when: DEEP }),
        i("sink", "Sink, counter and faucet clean and shining", "Lavabo, encimera y llave limpios y brillantes", { required: true }),
        i("mirror", "Mirrors streak-free", "Espejos sin rayas"),
        i("inside_vanity", "Inside of vanity and medicine cabinet wiped (empty home)", "Interior del tocador y botiquín limpio (casa vacía)", { when: MOVE }),
        i("floor", "Floor clean, including behind the toilet", "Piso limpio, incluso detrás del inodoro", { required: true }),
        i("trash", "Trash emptied", "Basura vaciada"),
      ] },
      { id: "rooms", en: "Bedrooms & living areas", es: "Recámaras y áreas comunes", items: [
        i("dust", "Reachable surfaces, shelves and decor dusted", "Superficies, repisas y adornos alcanzables sin polvo", { required: true }),
        i("glass", "Mirrors and glass tables streak-free", "Espejos y mesas de vidrio sin rayas"),
        i("beds", "Beds made (linens changed if fresh ones are left out)", "Camas tendidas (sábanas cambiadas si dejaron limpias)", { when: { q: "level", in: ["standard", "deep"] } }),
        i("floors", "Carpets vacuumed, hard floors vacuumed and mopped", "Alfombras aspiradas, pisos duros aspirados y trapeados", { required: true }),
        i("pet_hair", "Pet hair removed from floors and upholstery", "Pelo de mascota retirado de pisos y muebles", { when: { q: "pets", in: [true] } }),
        i("trash", "Trash emptied", "Basura vaciada"),
      ] },
      { id: "detail", en: "Deep-clean details", es: "Detalles de limpieza profunda", when: DEEP, items: [
        i("baseboards", "Baseboards hand-wiped", "Zócalos limpios a mano", { required: true }),
        i("doors", "Doors, door frames, switch plates and handles wiped", "Puertas, marcos, apagadores y manijas limpios", { required: true }),
        i("sills", "Window sills and tracks clean", "Alféizares y rieles de ventanas limpios"),
        i("fans", "Ceiling fans, light fixtures and vents dusted", "Ventiladores de techo, lámparas y rejillas sin polvo"),
        i("blinds", "Blinds dusted", "Persianas sin polvo"),
        i("under", "Under and behind movable furniture vacuumed", "Debajo y detrás de muebles movibles aspirado"),
        i("closets", "Closet shelves and floors clean (empty home)", "Repisas y pisos de clósets limpios (casa vacía)", { when: MOVE }),
        i("walls", "Walls spot-cleaned (marks and scuffs)", "Paredes sin manchas ni marcas", { when: MOVE }),
      ] },
    ],
  }),

  "unit-turnover": tpl({
    service: "unit-turnover", version: 1,
    title: { en: "Unit turnover checklist (rent-ready)", es: "Lista de preparación de unidad (lista para rentar)" },
    sections: [
      { id: "cleanout", en: "Cleanout", es: "Desalojo", when: { q: "cleanout", in: ["few", "quarter", "half"] }, items: [
        i("items", "Left-behind items removed; donate / recycle / dispose", "Objetos abandonados retirados; donar / reciclar / desechar", { required: true }),
        i("empty", "Closets, cabinets, garage and storage empty", "Clósets, gabinetes, garaje y bodega vacíos", { required: true }),
      ] },
      { id: "clean", en: "Move-out deep clean", es: "Limpieza profunda de salida", items: [
        i("kitchen", "Kitchen: counters, sink, stovetop, inside every cabinet and drawer", "Cocina: encimeras, fregadero, estufa, interior de cada gabinete y cajón", { required: true }),
        i("fridge", "Inside of fridge and oven, racks and door glass", "Interior del refrigerador y horno, parrillas y vidrio", { required: true }),
        i("baths", "Bathrooms: toilet, tub / shower, vanity inside and out, mirror, floor", "Baños: inodoro, tina / regadera, tocador por dentro y por fuera, espejo, piso", { required: true }),
        i("details", "Baseboards, doors, switch plates, sills, blinds and vents", "Zócalos, puertas, apagadores, alféizares, persianas y rejillas", { required: true }),
        i("floors", "All floors vacuumed and mopped", "Todos los pisos aspirados y trapeados", { required: true }),
        i("carpet", "Carpets cleaned (hot-water extraction)", "Alfombras lavadas (extracción con agua caliente)", { when: { q: "carpet", in: [true] }, required: true }),
      ] },
      { id: "repair", en: "Touch-ups & punch list", es: "Retoques y lista de pendientes", items: [
        i("holes", "Nail holes patched and touched up", "Agujeros de clavos resanados y retocados", { when: { q: "touchup", gt: 0 }, required: true }),
        i("punch", "Every punch-list item done, or noted with why not", "Cada pendiente terminado, o anotado por qué no", { when: { q: "punch", gt: 0 }, required: true }),
        i("bulbs", "Burned-out bulbs and smoke-detector issues noted for the manager", "Focos fundidos y detectores de humo con fallas anotados para el administrador"),
        i("damage", "Damage beyond normal wear photographed and noted", "Daños más allá del desgaste normal fotografiados y anotados", { photo: true }),
      ] },
    ],
  }),

  "carpet-cleaning": tpl({
    service: "carpet-cleaning", version: 1, title: { en: "Carpet cleaning checklist", es: "Lista de lavado de alfombras" },
    sections: [{ id: "carpet", en: "Carpets & upholstery", es: "Alfombras y tapicería", items: [
      i("stains", "Stains and high-traffic areas pointed out by the customer noted before starting", "Manchas y zonas de mucho tránsito señaladas por el cliente anotadas antes de empezar", { required: true }),
      i("rooms", "Every booked room cleaned edge to edge", "Cada cuarto reservado lavado de orilla a orilla", { required: true }),
      i("stairs", "Stairs cleaned", "Escaleras lavadas", { when: { q: "stairs", gt: 0 }, required: true }),
      i("sofa", "Upholstery cleaned", "Tapicería lavada", { when: { q: "sofa_seats", gt: 0 }, required: true }),
      i("pet", "Pet odor treatment applied where needed", "Tratamiento para olor de mascotas donde se necesitó", { when: { q: "pet", in: [true] } }),
      i("furniture", "Furniture moved back; protective tabs under legs", "Muebles regresados a su lugar; protectores bajo las patas"),
      i("dry", "Customer told the drying time and to avoid walking on wet carpet", "Cliente informado del tiempo de secado y de no pisar la alfombra mojada"),
    ] }],
  }),

  "window-cleaning": tpl({
    service: "window-cleaning", version: 1, title: { en: "Window cleaning checklist", es: "Lista de limpieza de ventanas" },
    sections: [{ id: "windows", en: "Windows", es: "Ventanas", items: [
      i("outside", "Outside glass clean and streak-free", "Vidrio exterior limpio y sin rayas", { required: true }),
      i("inside", "Inside glass clean and streak-free", "Vidrio interior limpio y sin rayas", { when: { q: "sides", in: ["both"] }, required: true }),
      i("screens", "Screens brushed and reinstalled", "Mosquiteros cepillados y reinstalados", { when: { q: "screens", in: [true] }, required: true }),
      i("sills", "Sills and tracks wiped", "Alféizares y rieles limpios"),
      i("drips", "Drips wiped from frames and sills; floors and furniture dry", "Gotas limpiadas de marcos y alféizares; pisos y muebles secos"),
    ] }],
  }),

  "gutter-cleaning": tpl({
    service: "gutter-cleaning", version: 1, title: { en: "Gutter cleaning checklist", es: "Lista de limpieza de canaletas" },
    sections: [{ id: "gutters", en: "Gutters", es: "Canaletas", items: [
      i("clear", "Every gutter run cleared by hand", "Cada tramo de canaleta limpiado a mano", { required: true, photo: true }),
      i("guards", "Gutter guards removed, cleaned under and reinstalled", "Protectores retirados, limpiado debajo y reinstalados", { when: { q: "guards", in: [true] }, required: true }),
      i("downspouts", "Downspouts flushed and flowing", "Bajantes destapadas y con buen flujo", { required: true }),
      i("debris", "Debris bagged and hauled; roof edge, beds and walks cleaned up", "Escombros embolsados y retirados; orilla del techo, jardineras y banquetas limpias", { required: true }),
      i("issues", "Loose hangers, leaks or damage photographed and noted", "Soportes flojos, fugas o daños fotografiados y anotados", { photo: true }),
    ] }],
  }),

  "power-washing": tpl({
    service: "power-washing", version: 1, title: { en: "Power washing checklist", es: "Lista de lavado a presión" },
    sections: [{ id: "wash", en: "Washing", es: "Lavado", items: [
      i("protect", "Plants, outlets, lights and nearby windows protected or rinsed", "Plantas, contactos, lámparas y ventanas cercanas protegidas o enjuagadas", { required: true }),
      i("surface", "The whole booked surface washed evenly (no stripes or etching)", "Toda la superficie reservada lavada de forma pareja (sin franjas ni marcas)", { required: true, photo: true }),
      i("mildew", "Mildew and stains pre-treated", "Moho y manchas pretratados"),
      i("seal", "Sealer applied after the surface dried", "Sellador aplicado con la superficie seca", { when: { q: "seal", in: [true] }, required: true }),
      i("rinse", "Debris and runoff rinsed from walks, siding and windows", "Residuos y escurrimientos enjuagados de banquetas, fachada y ventanas"),
    ] }],
  }),

  "lawn-care": tpl({
    service: "lawn-care", version: 1, title: { en: "Lawn care checklist", es: "Lista de cuidado del césped" },
    sections: [{ id: "lawn", en: "Lawn", es: "Césped", items: [
      i("mow", "Whole lawn mowed evenly", "Todo el césped cortado de forma pareja", { required: true, photo: true }),
      i("edge", "Walks, drive and beds edged", "Orillas de banquetas, entrada y jardineras recortadas", { required: true }),
      i("trim", "Trimmed around beds, trees, fences and obstacles", "Recortado alrededor de jardineras, árboles, cercas y obstáculos", { required: true }),
      i("blow", "Clippings blown off walks, drive, patio and street", "Recortes soplados de banquetas, entrada, patio y calle", { required: true }),
      i("leaves", "Leaves cleared", "Hojas retiradas", { when: { q: "leaves", in: [true] }, required: true }),
      i("aerate", "Lawn aerated", "Césped aireado", { when: { q: "aeration", in: [true] }, required: true }),
      i("fertilize", "Fertilizer applied; customer told when it's safe for kids and pets", "Fertilizante aplicado; cliente informado de cuándo es seguro para niños y mascotas", { when: { q: "fertilize", in: [true] }, required: true }),
      i("gate", "Gates closed; no items left in the yard", "Portones cerrados; nada olvidado en el jardín", { required: true }),
    ] }],
  }),

  "leaf-removal": tpl({
    service: "leaf-removal", version: 1, title: { en: "Leaf removal checklist", es: "Lista de retiro de hojas" },
    sections: [{ id: "leaves", en: "Leaves", es: "Hojas", items: [
      i("lawn", "Lawn cleared of leaves", "Césped sin hojas", { required: true, photo: true }),
      i("beds", "Beds and around shrubs cleared", "Jardineras y alrededor de arbustos sin hojas", { when: { q: "beds", in: [true] }, required: true }),
      i("hard", "Walks, drive and patio cleared", "Banquetas, entrada y patio sin hojas", { required: true }),
      i("downspouts", "Downspout outlets and drains cleared", "Salidas de bajantes y drenajes despejados"),
      i("haul", "Leaves hauled away", "Hojas retiradas del lugar", { when: { q: "haul", in: [true] }, required: true }),
      i("curb", "Leaves bagged at the curb per city rules", "Hojas embolsadas en la banqueta según las reglas de la ciudad", { when: { q: "haul", in: [true], not: true }, required: true }),
    ] }],
  }),

  "snow-removal": tpl({
    service: "snow-removal", version: 1, title: { en: "Snow removal checklist", es: "Lista de retiro de nieve" },
    sections: [{ id: "snow", en: "Snow", es: "Nieve", items: [
      i("drive", "Driveway or lot cleared edge to edge", "Entrada o estacionamiento despejado de orilla a orilla", { required: true, photo: true }),
      i("walks", "Walks shoveled to pavement", "Banquetas paleadas hasta el pavimento", { when: { q: "walks", in: [true] }, required: true }),
      i("steps", "Steps and porch shoveled", "Escalones y porche paleados", { when: { q: "steps", in: [true] }, required: true }),
      i("salt", "Ice melt spread on walks and steps", "Derretidor de hielo en banquetas y escalones", { when: { q: "salt", in: [true] }, required: true }),
      i("piles", "Snow piled away from doors, vents, hydrants and the street", "Nieve apilada lejos de puertas, ventilas, hidrantes y la calle"),
    ] }],
  }),

  "junk-removal": tpl({
    service: "junk-removal", version: 1, title: { en: "Junk removal checklist", es: "Lista de retiro de cosas" },
    sections: [{ id: "haul", en: "Haul-away", es: "Retiro", items: [
      i("confirm", "Every item to go confirmed with the customer (nothing taken that wasn't pointed out)", "Cada objeto a retirar confirmado con el cliente (no llevarse nada que no se haya señalado)", { required: true }),
      i("protect", "Floors and doorframes protected on the carry-out path", "Pisos y marcos protegidos en el camino de salida"),
      i("loaded", "All items loaded", "Todos los objetos cargados", { required: true, photo: true }),
      i("special", "Special-disposal items (tires, mattresses, appliances, paint) handled at the right facility", "Objetos de desecho especial (llantas, colchones, electrodomésticos, pintura) llevados al lugar correcto", { when: { q: "special", gt: 0 }, required: true }),
      i("sweep", "Area swept clean", "Área barrida", { required: true }),
      i("donate", "Donation and recycling receipts kept where available", "Recibos de donación y reciclaje guardados cuando haya"),
    ] }],
  }),

  "large-item-removal": tpl({
    service: "large-item-removal", version: 1, title: { en: "Large item removal checklist", es: "Lista de retiro de objetos grandes" },
    sections: [{ id: "items", en: "Items", es: "Objetos", items: [
      i("confirm", "Each item confirmed with the customer", "Cada objeto confirmado con el cliente", { required: true }),
      i("protect", "Floors, stairs and doorframes protected", "Pisos, escaleras y marcos protegidos", { required: true }),
      i("disconnect", "Appliances disconnected safely (water / gas shut off and capped by a qualified person)", "Electrodomésticos desconectados con seguridad (agua / gas cerrados y tapados por una persona calificada)"),
      i("disassembly", "Disassembled and every part removed", "Desarmado y todas las piezas retiradas", { when: { q: "disassembly", in: [true] } }),
      i("removed", "All items removed", "Todos los objetos retirados", { required: true, photo: true }),
      i("sweep", "Spot where items stood swept clean", "Lugar donde estaban los objetos barrido"),
    ] }],
  }),

  "small-moves": tpl({
    service: "small-moves", version: 1, title: { en: "Moving checklist", es: "Lista de mudanza" },
    sections: [
      { id: "pickup", en: "Pickup", es: "Recolección", items: [
        i("inventory", "Item list confirmed with the customer; pre-existing damage photographed", "Lista de objetos confirmada con el cliente; daños previos fotografiados", { required: true, photo: true }),
        i("protect", "Floors and doorframes protected at both places", "Pisos y marcos protegidos en ambos lugares", { required: true }),
        i("pack", "Packing done for the agreed rooms", "Empaque hecho en los cuartos acordados", { when: { q: "packing", in: [true] }, required: true }),
        i("wrap", "Furniture wrapped in blankets; loose parts bagged and labeled", "Muebles envueltos en cobijas; piezas sueltas embolsadas y etiquetadas", { required: true }),
        i("empty", "Every room checked empty before leaving", "Cada cuarto revisado vacío antes de salir", { required: true }),
      ] },
      { id: "dropoff", en: "Drop-off", es: "Entrega", items: [
        i("placed", "Everything placed in the room the customer chose", "Todo colocado en el cuarto que eligió el cliente", { required: true }),
        i("assembled", "Furniture taken apart for the move put back together", "Muebles desarmados para la mudanza vueltos a armar", { required: true }),
        i("count", "Item count checked with the customer; nothing left in the truck", "Conteo de objetos revisado con el cliente; nada quedó en el camión", { required: true }),
      ] },
    ],
  }),

  "retail-delivery": tpl({
    service: "retail-delivery", version: 1, title: { en: "Delivery checklist", es: "Lista de entrega" },
    sections: [{ id: "delivery", en: "Delivery", es: "Entrega", items: [
      i("pickup", "Items checked against the order at pickup; damage photographed", "Objetos revisados contra el pedido al recoger; daños fotografiados", { required: true, photo: true }),
      i("protect", "Floors and doorframes protected", "Pisos y marcos protegidos", { required: true }),
      i("placed", "Placed in the room the customer chose", "Colocado en el cuarto que eligió el cliente", { required: true }),
      i("assembly", "Assembled and checked", "Armado y revisado", { when: { q: "assembly", in: [true] }, required: true }),
      i("packaging", "Packaging taken away", "Empaques retirados"),
      i("old", "Old item hauled away", "Objeto viejo retirado", { when: { q: "haul_old", in: [true] }, required: true }),
      i("proof", "Photo of the delivered item in place", "Foto del objeto entregado en su lugar", { required: true, photo: true }),
    ] }],
  }),

  "handyman": tpl({
    service: "handyman", version: 1, title: { en: "Handyman checklist", es: "Lista de mantenimiento general" },
    sections: [{ id: "tasks", en: "Tasks", es: "Tareas", items: [
      i("list", "Task list confirmed with the customer; anything outside the booked time flagged for a change order", "Lista de tareas confirmada con el cliente; lo que exceda el tiempo reservado marcado para orden de cambio", { required: true }),
      i("protect", "Floors and furniture near the work protected", "Pisos y muebles cerca del trabajo protegidos"),
      i("done", "Every task finished and tested (doors close, fixtures work, nothing loose)", "Cada tarea terminada y probada (puertas cierran, accesorios funcionan, nada flojo)", { required: true }),
      i("receipts", "Material receipts uploaded", "Recibos de materiales subidos", { when: { q: "materials", in: [true] }, required: true }),
      i("dust", "Dust and offcuts cleaned up", "Polvo y recortes limpiados", { required: true }),
    ] }],
  }),

  "interior-painting": tpl({
    service: "interior-painting", version: 1, title: { en: "Interior painting checklist", es: "Lista de pintura interior" },
    sections: [{ id: "paint", en: "Painting", es: "Pintura", items: [
      i("colors", "Colors and finishes confirmed with the customer for each room", "Colores y acabados confirmados con el cliente para cada cuarto", { required: true }),
      i("protect", "Floors and furniture covered; outlet and switch plates removed", "Pisos y muebles cubiertos; tapas de contactos y apagadores retiradas", { required: true }),
      i("repairs", "Holes and cracks patched and sanded", "Agujeros y grietas resanados y lijados", { when: { q: "repairs", in: [true] }, required: true }),
      i("coats", "Full coverage, no holidays or roller marks", "Cobertura completa, sin huecos ni marcas de rodillo", { required: true }),
      i("lines", "Clean cut lines at ceilings, trim and corners", "Líneas limpias en techos, molduras y esquinas", { required: true }),
      i("ceilings", "Ceilings painted", "Techos pintados", { when: { q: "ceilings", in: [true] }, required: true }),
      i("trim", "Trim and doors painted", "Molduras y puertas pintadas", { when: { q: "trim", in: [true] }, required: true }),
      i("reset", "Plates reinstalled; furniture back; touch-up paint left labeled for the customer", "Tapas reinstaladas; muebles en su lugar; pintura para retoques etiquetada para el cliente", { required: true }),
    ] }],
  }),

  "dead-animal-removal": tpl({
    service: "dead-animal-removal", version: 1, title: { en: "Dead animal removal checklist", es: "Lista de retiro de animales muertos" },
    sections: [{ id: "removal", en: "Removal", es: "Retiro", items: [
      i("ppe", "Gloves, respirator and protective clothing on before handling", "Guantes, respirador y ropa protectora puestos antes de manipular", { required: true }),
      i("before", "Photo of the animal where it was found", "Foto del animal donde se encontró", { required: true, photo: true }),
      i("bagged", "Every animal sealed in double bags and removed", "Cada animal sellado en doble bolsa y retirado", { required: true }),
      i("access", "Crawlspace, deck or attic access closed back up as found", "Acceso al entrepiso, terraza o ático cerrado como estaba", { when: { q: "where", in: ["under", "attic"] }, required: true }),
      i("sanitize", "Area sanitized and deodorized", "Área desinfectada y desodorizada", { when: { q: "sanitize", in: [true] }, required: true }),
      i("pet", "Pet delivered to the vet or crematory; name and receipt noted", "Mascota entregada al veterinario o crematorio; nombre y recibo anotados", { when: { q: "pet", in: [true] }, required: true }),
      i("after", "After photo of the cleared area", "Foto del área despejada", { required: true, photo: true }),
      i("disposal", "Disposed of the same day at an approved site (landfill, rendering or crematory)", "Desechado el mismo día en un sitio aprobado (relleno sanitario, planta de procesamiento o crematorio)", { when: { q: "pet", in: [false] }, required: true }),
    ] }],
  }),

  "pet-waste-removal": tpl({
    service: "pet-waste-removal", version: 1, title: { en: "Pet waste removal checklist", es: "Lista de retiro de desechos de mascotas" },
    sections: [{ id: "yard", en: "Yard", es: "Patio", items: [
      i("sweep", "Whole yard swept, including along fences and under decks", "Todo el patio recorrido, incluso junto a cercas y bajo terrazas", { required: true }),
      i("bagged", "Waste bagged and removed", "Desechos embolsados y retirados", { required: true }),
      i("deodorize", "Deodorizer applied", "Desodorante aplicado", { when: { q: "deodorize", in: [true] }, required: true }),
      i("gate", "Gate closed and latched — photo", "Portón cerrado y asegurado — foto", { required: true, photo: true }),
    ] }],
  }),

  "organizing": tpl({
    service: "organizing", version: 1, title: { en: "Organizing checklist", es: "Lista de organización" },
    sections: [{ id: "org", en: "Organizing", es: "Organización", items: [
      i("goals", "Goals and keep / donate / toss decisions agreed with the customer", "Objetivos y decisiones de conservar / donar / tirar acordados con el cliente", { required: true }),
      i("sorted", "Every booked space sorted", "Cada espacio reservado clasificado", { required: true }),
      i("systems", "Storage systems set up and labeled", "Sistemas de almacenamiento instalados y etiquetados"),
      i("haul", "Donations dropped off and trash hauled away", "Donaciones entregadas y basura retirada", { when: { q: "haul", in: [true] }, required: true }),
      i("receipts", "Purchase receipts uploaded", "Recibos de compras subidos", { when: { q: "shopping", in: [true] }, required: true }),
    ] }],
  }),

  "plumbing": tpl({
    service: "plumbing", version: 1, title: { en: "Plumbing checklist", es: "Lista de plomería" },
    sections: [{ id: "plumb", en: "Plumbing", es: "Plomería", items: [
      i("diagnose", "Problem confirmed and explained to the customer before work starts; anything beyond the booked repair flagged for a change order", "Problema confirmado y explicado al cliente antes de empezar; lo que exceda la reparación reservada marcado para orden de cambio", { required: true }),
      i("protect", "Floors and cabinets protected under the work", "Pisos y gabinetes protegidos bajo el trabajo"),
      i("fixed", "Repair finished", "Reparación terminada", { required: true, photo: true }),
      i("test", "Water back on; no leaks after running the fixture for several minutes", "Agua restablecida; sin fugas después de usar el accesorio varios minutos", { required: true }),
      i("parts", "Receipts uploaded for parts not included", "Recibos subidos de piezas no incluidas"),
    ] }],
  }),

  "water-heater": tpl({
    service: "water-heater", version: 1, title: { en: "Water heater checklist", es: "Lista de calentador de agua" },
    sections: [{ id: "wh", en: "Water heater", es: "Calentador de agua", items: [
      i("permit", "Permit pulled where required", "Permiso obtenido donde se requiere", { when: { q: "job", in: ["replace", "budget", "install"] }, required: true }),
      i("installed", "Unit installed to code: venting, gas / electrical, relief valve and discharge pipe", "Unidad instalada según el código: ventilación, gas / electricidad, válvula de alivio y tubo de descarga", { when: { q: "job", in: ["replace", "budget", "install"] }, required: true, photo: true }),
      i("expansion", "Expansion tank installed", "Tanque de expansión instalado", { when: { q: "expansion", in: [true] }, required: true }),
      i("repaired", "Repair finished and the unit heats", "Reparación terminada y la unidad calienta", { when: { q: "job", in: ["repair"] }, required: true }),
      i("test", "No leaks; hot water at a tap; gas connections leak-tested", "Sin fugas; agua caliente en una llave; conexiones de gas probadas contra fugas", { required: true }),
      i("old", "Old tank hauled away", "Tanque viejo retirado", { when: { q: "job", in: ["replace", "budget"] }, required: true }),
      i("label", "Install date, model and serial photographed for the warranty", "Fecha de instalación, modelo y serie fotografiados para la garantía", { photo: true }),
    ] }],
  }),

  "garbage-disposal": tpl({
    service: "garbage-disposal", version: 1, title: { en: "Garbage disposal checklist", es: "Lista de triturador de basura" },
    sections: [{ id: "gd", en: "Disposal", es: "Triturador", items: [
      i("work", "Disposal repaired or installed", "Triturador reparado o instalado", { required: true, photo: true }),
      i("test", "Runs with water; no leaks at the sink flange, drain or dishwasher hose", "Funciona con agua; sin fugas en la brida, el desagüe o la manguera del lavavajillas", { required: true }),
      i("old", "Old unit hauled away", "Unidad vieja retirada", { when: { q: "job", in: ["replace_half", "replace_34"] }, required: true }),
    ] }],
  }),

  "lighting-install": tpl({
    service: "lighting-install", version: 1, title: { en: "Lighting install checklist", es: "Lista de instalación de iluminación" },
    sections: [{ id: "light", en: "Lighting", es: "Iluminación", items: [
      i("power", "Power off at the breaker before work", "Electricidad cortada en el interruptor antes de trabajar", { required: true }),
      i("installed", "Every booked fixture, fan and light installed level and secure", "Cada lámpara, ventilador y luz reservados instalados nivelados y firmes", { required: true, photo: true }),
      i("test", "Power restored; every light, switch and fan speed tested", "Electricidad restablecida; cada luz, apagador y velocidad de ventilador probados", { required: true }),
      i("old", "Old fixtures removed and hauled away", "Lámparas viejas retiradas"),
    ] }],
  }),

  "exterior-painting": tpl({
    service: "exterior-painting", version: 1, title: { en: "Exterior painting checklist", es: "Lista de pintura exterior" },
    sections: [{ id: "paint", en: "Painting", es: "Pintura", items: [
      i("colors", "Colors and areas confirmed with the customer", "Colores y áreas confirmados con el cliente", { required: true }),
      i("lead", "Lead-safe practices (EPA RRP) for homes built before 1978", "Prácticas seguras con plomo (EPA RRP) en casas construidas antes de 1978", { required: true }),
      i("prep", "Washed, scraped, sanded, primed and caulked where needed", "Lavado, raspado, lijado, con primer y sellado donde se necesitó", { required: true, photo: true }),
      i("coats", "Full coverage on siding and trim, clean lines at windows and doors", "Cobertura completa en fachada y molduras, líneas limpias en ventanas y puertas", { required: true }),
      i("deck", "Deck stained or painted", "Terraza teñida o pintada", { when: { q: "deck", in: [true] }, required: true }),
      i("cleanup", "Paint chips collected; plants, windows and walks clean", "Restos de pintura recogidos; plantas, ventanas y banquetas limpias", { required: true }),
    ] }],
  }),

  "tree-removal": tpl({
    service: "tree-removal", version: 1, title: { en: "Tree work checklist", es: "Lista de trabajo de árboles" },
    sections: [{ id: "tree", en: "Trees", es: "Árboles", items: [
      i("plan", "Trees, drop zones and anything to protect confirmed with the customer", "Árboles, zonas de caída y lo que hay que proteger confirmados con el cliente", { required: true }),
      i("lines", "Power lines checked; utility called if lines are involved", "Cables eléctricos revisados; compañía de luz llamada si hay cables involucrados", { required: true }),
      i("done", "Every booked tree trimmed or removed", "Cada árbol reservado podado o retirado", { required: true, photo: true }),
      i("stump", "Stump ground below grade", "Tocón triturado bajo el nivel del suelo", { when: { q: "stump", in: [true] }, required: true }),
      i("haul", "Wood and debris hauled; lawn raked and blown", "Madera y escombros retirados; césped rastrillado y soplado", { required: true }),
    ] }],
  }),

  "junk-container": tpl({
    service: "junk-container", version: 1, title: { en: "Container drop-off & pickup checklist", es: "Lista de entrega y recolección de contenedor" },
    sections: [
      { id: "drop", en: "Drop-off", es: "Entrega", items: [
        i("spot", "Placement spot confirmed with the customer (and street permit when on the street)", "Lugar confirmado con el cliente (y permiso de calle si va en la calle)", { required: true }),
        i("boards", "Protection boards under the container", "Tablas de protección bajo el contenedor", { required: true }),
        i("placed", "Container placed; photo of the spot and the driveway before", "Contenedor colocado; foto del lugar y de la entrada antes", { required: true, photo: true }),
      ] },
      { id: "pick", en: "Pickup", es: "Recolección", items: [
        i("load", "Load checked: not over the top, no banned items", "Carga revisada: no rebasa el borde, sin objetos prohibidos", { required: true }),
        i("driveway", "Driveway photographed after pickup", "Entrada fotografiada después de recoger", { required: true, photo: true }),
        i("ticket", "Landfill weigh ticket uploaded as a receipt", "Boleta de peso del relleno sanitario subida como recibo", { required: true }),
      ] },
    ],
  }),

  "event-security": {
    service: "event-security", version: 1, title: { en: "Event security checklist", es: "Lista de seguridad para eventos" },
    sections: [
      FRAMES.events[0],
      { id: "posts", en: "Posts & duties", es: "Puestos y tareas", items: [
        i("briefing", "Posts, duties, entrances, guest list and emergency exits confirmed with the host", "Puestos, tareas, entradas, lista de invitados y salidas de emergencia confirmados con el anfitrión", { required: true }),
        i("staffed", "Every booked post staffed for the full booked hours", "Cada puesto reservado cubierto durante todas las horas reservadas", { required: true }),
        i("id_checks", "Door, ID and guest-list checks done as the host asked", "Control de puerta, identificaciones y lista de invitados según lo pidió el anfitrión"),
        i("alcohol", "Watched for over-serving and underage drinking; told the bar staff and host about problems", "Vigilancia de exceso de alcohol y menores que beben; problemas avisados al personal del bar y al anfitrión",),
        i("armed", "Armed officers' authorization and licenses on hand", "Autorización y licencias de los oficiales armados a la mano", { when: { q: "type", in: ["armed"] }, required: true }),
        i("exit", "Guests out safely at the end; parking lot and entrances checked", "Invitados fuera de forma segura al final; estacionamiento y entradas revisados", { required: true }),
        i("incidents", "Incident report filed (or \"no incidents\" noted)", "Reporte de incidentes presentado (o anotado \"sin incidentes\")", { required: true }),
      ] },
      FRAMES.events[1],
    ],
  },

  "security-guard": {
    service: "security-guard", version: 1, title: { en: "Security coverage checklist", es: "Lista de cobertura de seguridad" },
    sections: [
      { id: "start", en: "Start of shift", es: "Inicio del turno", items: [
        i("orders", "Post orders confirmed: areas to cover, shift times, access, and who to call for incidents", "Órdenes del puesto confirmadas: áreas a cubrir, horario, acceso y a quién llamar por incidentes", { required: true }),
        i("on_time", "On site (or first patrol check) at the booked time, in uniform with the agency ID", "En el lugar (o primera ronda) a la hora reservada, con uniforme e identificación de la agencia", { required: true }),
        i("armed", "Armed officer's authorization and licenses on hand", "Autorización y licencias del oficial armado a la mano", { when: { q: "type", in: ["armed"] }, required: true }),
      ] },
      { id: "duty", en: "Coverage", es: "Cobertura", items: [
        i("post", "Post staffed for the full shift; no gaps at shift change", "Puesto cubierto todo el turno; sin huecos en el cambio de turno", { when: { q: "kind", in: ["post"] }, required: true }),
        i("rounds", "Rounds walked on the agreed schedule; doors, lights and the lot checked", "Rondas hechas según lo acordado; puertas, luces y estacionamiento revisados", { when: { q: "kind", in: ["post"] } }),
        i("patrol", "Every booked patrol check done: outside walked, doors tested, lights and lot checked, photo each time", "Cada ronda reservada hecha: exterior recorrido, puertas probadas, luces y estacionamiento revisados, foto cada vez", { when: { q: "kind", in: ["patrol"] }, required: true, photo: true }),
        i("fire_rounds", "Fire watch rounds of every area at least hourly, logged with times; extinguishers and exits checked", "Rondas de vigilancia contra incendios en cada área al menos cada hora, registradas con horas; extintores y salidas revisados", { when: { q: "kind", in: ["fire_watch"] }, required: true }),
        i("incidents", "Anything unusual reported to the customer right away (police or 911 first in an emergency)", "Todo lo inusual reportado al cliente de inmediato (policía o 911 primero en una emergencia)", { required: true }),
      ] },
      { id: "end", en: "End of shift", es: "Fin del turno", items: [
        i("secure", "Site left secure: doors locked, alarm set if asked", "Lugar asegurado al salir: puertas cerradas, alarma activada si se pidió", { required: true }),
        i("report", "Daily activity report with photos filed (or \"no incidents\" noted)", "Reporte diario de actividad con fotos presentado (o anotado \"sin incidentes\")", { required: true, photo: true }),
      ] },
    ],
  },

  "dog-walking": {
    service: "dog-walking", version: 1, title: { en: "Dog walk checklist", es: "Lista de paseo de perros" },
    sections: [
      FRAMES.pets[0],
      { id: "walk", en: "Walk", es: "Paseo", items: [
        i("leash", "Leash and harness checked before leaving", "Correa y arnés revisados antes de salir", { required: true }),
        i("walked", "Walked for the full booked time", "Paseado el tiempo completo reservado", { required: true }),
        i("waste", "Waste picked up", "Desechos recogidos", { required: true }),
        i("water", "Fresh water and paws wiped after the walk", "Agua fresca y patas limpias después del paseo"),
      ] },
      FRAMES.pets[1],
    ],
  },

  "mobile-car-detailing": tpl({
    service: "mobile-car-detailing", version: 1, title: { en: "Car detailing checklist", es: "Lista de detallado de auto" },
    sections: [{ id: "car", en: "Vehicle", es: "Vehículo", items: [
      i("walkaround", "Walk-around photos of existing scratches and dents", "Fotos alrededor del auto de rayones y golpes existentes", { required: true, photo: true }),
      i("valuables", "Customer asked to remove valuables", "Se le pidió al cliente retirar objetos de valor"),
      i("exterior", "Exterior washed and dried, wheels and tires clean", "Exterior lavado y secado, rines y llantas limpios", { when: { q: "package", in: ["exterior", "full", "ceramic"] }, required: true }),
      i("interior", "Interior vacuumed; dash, console, doors and glass wiped", "Interior aspirado; tablero, consola, puertas y vidrios limpios", { when: { q: "package", in: ["interior", "full", "ceramic"] }, required: true }),
      i("stains", "Seat and carpet stains treated", "Manchas de asientos y alfombras tratadas", { when: { q: "stains", in: [true] } }),
      i("pet_hair", "Pet hair removed", "Pelo de mascota retirado", { when: { q: "pet_hair", in: [true] }, required: true }),
      i("headlights", "Headlights restored", "Faros restaurados", { when: { q: "headlights", in: [true] }, required: true }),
      i("ceramic", "Ceramic coating applied; cure instructions given to the customer", "Recubrimiento cerámico aplicado; instrucciones de curado dadas al cliente", { when: { q: "package", in: ["ceramic"] }, required: true }),
    ] }],
  }),
};

// ── Resolving a job's checklist ──────────────────────────────────────────────

export interface ChecklistLine { id: string; text: string; text_es: string; required: boolean; photo: boolean; from?: "template" | "staff" | "customer" | "access" | "notes" }
export interface ChecklistBlock { id: string; title: string; title_es: string; items: ChecklistLine[] }
export interface JobChecklist { service: string; version: number; title: string; title_es: string; sections: ChecklistBlock[] }

/** A special instruction added to one job (by staff, or a customer request before the job starts). */
export interface ChecklistExtra { id: string; text: string; required?: boolean; from: "staff" | "customer"; at?: string }

export interface ChecklistJob { service_slug: string; answers?: Record<string, unknown> | null; notes?: string | null; instructions?: string | null; checklist?: JobChecklist | null; checklist_extra?: ChecklistExtra[] | null }

const matches = (c: ChecklistCond | undefined, a: Record<string, unknown>): boolean => {
  if (!c) return true;
  const v = a[c.q];
  let ok = true;
  if (c.in) ok = c.in.some((x) => x === v || String(x) === String(v));
  if (c.gt !== undefined) ok = ok && Number(v ?? 0) > c.gt;
  return c.not ? !ok : ok;
};

/** Marketing lines in a service's "includes" (who we are, how we price) aren't things to check off on a job. */
const NOT_A_TASK = /licensed|insured|vetted|background|bonded|guarantee|warrant|pricing|flat rate|free |consult|payments|dashboard|available|on request|operator|chauffeur|cdl|driver|trained|on file|you choose|for you|included|up to \d|crew$|walker$|sitter$|courier$|runner$|assistant$|tracking link|planning|\(option\)|fees|meet & greet|every visit|allowance|stretch or|sound system|photo|3d layout|project manager|shortlist/i;

/** A service without its own template: the booked scope, the deliverables it includes, and the right start / finish. */
function generic(slug: string): ChecklistTemplate {
  const svc = getService(slug);
  const work: ChecklistSectionDef = { id: "work", en: "The work", es: "El trabajo", items: [
    i("scope", "Everything in the booked scope done (see Scope on the work order)", "Todo el alcance reservado terminado (vea Alcance en la orden de trabajo)", { required: true }),
    ...(svc?.includes ?? []).filter((x) => !NOT_A_TASK.test(x)).map((x, n) => i(`inc${n + 1}`, x, tr("es", x))),
    ...(svc && svc.category === "repair_remodel" ? [i("tested", "Work tested and working before you leave (no leaks, power on, doors and fixtures work)", "Trabajo probado y funcionando antes de irse (sin fugas, con electricidad, puertas y accesorios funcionan)", { required: true })] : []),
  ] };
  const frame = svc ? FRAMES[svc.category] : undefined;
  const title = { en: `${svc?.name ?? "Job"} checklist`, es: `Lista: ${svc ? serviceText("es", svc.slug, svc).name : "trabajo"}` };
  return frame ? { service: slug, version: 1, title, sections: [frame[0], work, frame[1]] } : tpl({ service: slug, version: 1, title, sections: [work] });
}

export const checklistTemplate = (slug: string): ChecklistTemplate => CHECKLISTS[slug] ?? generic(slug);

/** Template + answers → the job's checklist (no special instructions). Frozen on the job when a pro accepts. */
export function buildChecklist(slug: string, answers: Record<string, unknown> = {}): JobChecklist {
  const t = checklistTemplate(slug);
  const title = (t.titleBy && t.titleBy.map[String(answers[t.titleBy.q] ?? "")]) || t.title;
  return {
    service: slug, version: t.version, title: title.en, title_es: title.es,
    sections: t.sections.filter((s) => matches(s.when, answers)).map((s) => ({
      id: s.id, title: s.en, title_es: s.es,
      items: s.items.filter((x) => matches(x.when, answers)).map((x) => ({ id: `${s.id}.${x.id}`, text: x.en, text_es: x.es, required: Boolean(x.required), photo: Boolean(x.photo), from: "template" as const })),
    })).filter((s) => s.items.length),
  };
}

/** Lines of free text ("a; b" or one per line) → separate instructions. */
const splitLines = (s: string | null | undefined) => (s ?? "").split(/\n+/).map((x) => x.trim()).filter(Boolean);

/** The job's full checklist: special instructions first, then the (frozen or current) template. */
export function resolveChecklist(job: ChecklistJob): JobChecklist {
  const base = job.checklist ?? buildChecklist(job.service_slug, (job.answers ?? {}) as Record<string, unknown>);
  const special: ChecklistLine[] = [];
  splitLines(job.instructions).forEach((text, n) => special.push({ id: `special.instr${n + 1}`, text, text_es: text, required: true, photo: false, from: text.startsWith("Access") ? "access" : "staff" }));
  for (const x of job.checklist_extra ?? []) special.push({ id: `special.${x.id}`, text: x.text, text_es: x.text, required: x.required ?? x.from === "staff", photo: false, from: x.from });
  if (job.notes?.trim()) special.push({ id: "special.notes", text: `Customer's notes read and followed: "${job.notes.trim()}"`, text_es: `Notas del cliente leídas y atendidas: "${job.notes.trim()}"`, required: true, photo: false, from: "notes" });
  if (!special.length) return base;
  return { ...base, sections: [{ id: "special", title: "Special instructions", title_es: "Instrucciones especiales", items: special }, ...base.sections] };
}

export interface ChecklistCheck { item_id: string; status: "done" | "na"; note?: string | null; checked_at?: string | null }

/** Where the job stands; `open` = required items neither done nor marked N/A. */
export function checklistProgress(c: JobChecklist, checks: ChecklistCheck[]) {
  const by = new Map(checks.map((x) => [x.item_id, x]));
  const items = c.sections.flatMap((s) => s.items);
  const done = items.filter((x) => by.get(x.id)?.status === "done").length;
  const na = items.filter((x) => by.get(x.id)?.status === "na").length;
  const open = items.filter((x) => x.required && !by.has(x.id));
  return { total: items.length, done, na, left: items.length - done - na, open, pct: items.length ? Math.round(((done + na) / items.length) * 100) : 100 };
}

/** Plain text for work orders, emails and the AI photo review. */
export function checklistText(c: JobChecklist, locale: "en" | "es" | string | null = "en", checks?: ChecklistCheck[]): string {
  const es = locale === "es";
  const by = new Map((checks ?? []).map((x) => [x.item_id, x]));
  const mark = (id: string) => { const k = by.get(id); return !checks ? "☐" : k?.status === "done" ? "☑" : k?.status === "na" ? `N/A${k.note ? ` (${k.note})` : ""} —` : "☐"; };
  return [es ? c.title_es.toUpperCase() : c.title.toUpperCase(), ...c.sections.flatMap((s) => [
    `${es ? s.title_es : s.title}:`,
    ...s.items.map((x) => `  ${mark(x.id)} ${es ? x.text_es : x.text}${x.required ? " *" : ""}${x.photo ? " 📷" : ""}`),
  ]), es ? "* obligatorio (o N/A con motivo) · 📷 foto" : "* required (or N/A with a reason) · 📷 photo"].join("\n");
}

/** The whole template for the library pages, with when each conditional section / item applies ("Deep clean", "Pets in the home"). */
export function checklistOutline(slug: string, locale: "en" | "es" = "en") {
  const t = checklistTemplate(slug);
  const svc = getService(slug);
  const es = locale === "es";
  const label = (c?: ChecklistCond): string | null => {
    if (!c) return null;
    const q = svc?.questions.find((x) => x.id === c.q);
    if (!q) return null;
    const ql = es ? tr("es", q.label) : q.label;
    let txt: string;
    if (q.type === "select" && c.in) txt = c.in.map((v) => { const o = q.options.find((x) => String(x.value) === String(v)); return o ? (es ? tr("es", o.label) : o.label) : String(v); }).join(" / ");
    else if (q.type === "toggle") txt = ql;
    else if (c.gt !== undefined) txt = `${ql} > ${c.gt}`;
    else txt = ql;
    return c.not ? `${es ? "sin" : "not"}: ${txt}` : txt;
  };
  const title = es ? t.title.es : t.title.en;
  return {
    service: slug, version: t.version, title, custom: Boolean(CHECKLISTS[slug]),
    variants: t.titleBy ? Object.values(t.titleBy.map).map((x) => (es ? x.es : x.en)) : [],
    sections: t.sections.map((s) => ({ id: s.id, title: es ? s.es : s.en, when: label(s.when),
      items: s.items.map((x) => ({ id: `${s.id}.${x.id}`, text: es ? x.es : x.en, required: Boolean(x.required), photo: Boolean(x.photo), when: label(x.when) })) })),
  };
}
