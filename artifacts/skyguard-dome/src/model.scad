// ═══════════════════════════════════════════════
//  SKYGUARD BOX — DOME ENCLOSURE
//  Две части: бял купол (RF прозрачен) + черна основа
//  За Bambu P1S — 256×256×256mm build volume
// ═══════════════════════════════════════════════

$fn = 120;
epsilon = 0.01;

// ── Главни размери ──────────────────────────────
outer_diameter    = 230;   // диаметър (mm) — влиза в P1S 256mm
wall_thickness    = 4;     // дебелина на стените (mm)
bolt_count        = 8;     // брой болтове M4 на ринга
bolt_diameter     = 4.5;   // отвор за M4 болт (mm)
bolt_circle_r     = outer_diameter / 2 - 10; // радиус на болтовия кръг

// ── Основа (черна) ──────────────────────────────
base_height       = 75;    // височина на основата (mm)
base_color        = "Black";

// ── Купол (бял) ─────────────────────────────────
dome_height       = 125;   // височина на купола (mm)
dome_color        = "White";

// ── Преход между двете части ─────────────────────
flange_height     = 12;    // ринг за свързване (mm)
flange_overlap    = 8;     // припокриване (mm) — купола влиза върху основата
gasket_groove_w   = 3;     // ширина на жлеба за силиконов уплътнител
gasket_groove_d   = 2;     // дълбочина на жлеба

// ── Кабелен вход отдолу ─────────────────────────
cable_gland_d     = 22;    // отвор за PG16 кабелна жлеза (mm)
cable_gland_x     = 0;     // позиция X (центъра)

// ── Монтажна стойка отдолу ──────────────────────
mount_hole_d      = 20;    // дупка за монтажна тръба/болт (mm)

outer_r = outer_diameter / 2;
inner_r = outer_r - wall_thickness;

// ══════════════════════════════════════════════════
//  МОДУЛ: ОСНОВА
// ══════════════════════════════════════════════════
module base() {
    color(base_color)
    difference() {
        union() {
            // Основно цилиндрично тяло
            cylinder(h = base_height, r = outer_r);

            // Фланец (ринг) за свързване с купола
            translate([0, 0, base_height - epsilon])
            cylinder(h = flange_height, r = outer_r);
        }

        // Вътрешна кухина
        translate([0, 0, wall_thickness])
        cylinder(h = base_height + flange_height + epsilon, r = inner_r);

        // Дъно — оставяме го солидно (wall_thickness дебелина)

        // Жлеб за силиконов O-ring на ринга
        translate([0, 0, base_height + flange_height / 2])
        rotate_extrude()
        translate([outer_r - gasket_groove_w / 2, 0, 0])
        square([gasket_groove_w, gasket_groove_d], center = true);

        // Болтови отвори на фланеца
        for (i = [0 : bolt_count - 1]) {
            angle = i * 360 / bolt_count;
            translate([
                bolt_circle_r * cos(angle),
                bolt_circle_r * sin(angle),
                base_height + flange_height / 2
            ])
            cylinder(h = flange_height + epsilon * 2, r = bolt_diameter / 2, center = true);
        }

        // Кабелна жлеза — дупка в дъното
        translate([cable_gland_x, 0, -epsilon])
        cylinder(h = wall_thickness + epsilon * 2, r = cable_gland_d / 2);

        // Монтажен отвор в центъра на дъното
        translate([0, 0, -epsilon])
        cylinder(h = wall_thickness + epsilon * 2, r = mount_hole_d / 2);
    }
}

// ══════════════════════════════════════════════════
//  МОДУЛ: КУПОЛ
// ══════════════════════════════════════════════════
module dome() {
    color(dome_color)
    difference() {
        union() {
            // Вътрешен цилиндричен скрт (влиза в основата)
            cylinder(h = flange_overlap + wall_thickness, r = inner_r - 0.3);

            // Полусфера — изграждаме с scale за овален купол
            translate([0, 0, flange_overlap])
            scale([1, 1, dome_height / outer_r])
            difference() {
                sphere(r = outer_r);
                translate([0, 0, -outer_r - epsilon])
                cube([outer_r * 2 + epsilon, outer_r * 2 + epsilon, outer_r + epsilon], center = true);
            }
        }

        // Изкухваме купола отвътре
        // Цилиндричен вътрешен скрт
        translate([0, 0, -epsilon])
        cylinder(h = flange_overlap + wall_thickness + epsilon, r = inner_r - wall_thickness - 0.3);

        // Вътрешност на сферата
        translate([0, 0, flange_overlap])
        scale([1, 1, (dome_height - wall_thickness) / (outer_r - wall_thickness)])
        difference() {
            sphere(r = outer_r - wall_thickness);
            translate([0, 0, -(outer_r) - epsilon])
            cube([(outer_r) * 2 + epsilon, (outer_r) * 2 + epsilon, outer_r + epsilon], center = true);
        }

        // Болтови отвори на скрта
        for (i = [0 : bolt_count - 1]) {
            angle = i * 360 / bolt_count;
            translate([
                bolt_circle_r * cos(angle),
                bolt_circle_r * sin(angle),
                flange_overlap / 2 + wall_thickness / 2
            ])
            cylinder(h = flange_overlap + wall_thickness + epsilon * 2, r = bolt_diameter / 2, center = true);
        }
    }
}

// ══════════════════════════════════════════════════
//  РЕНДЕР — двете части наредени за печат
//  Основата е на позиция 0, куполът е повдигнат
//  с малко разстояние за лесно разграничаване
// ══════════════════════════════════════════════════

// Основа (черна) — ориентирана за печат (дъното долу)
base();

// Купол (бял) — наредени до основата за преглед
// При печат: завърташ го с 180° (отвора надолу)
translate([outer_diameter + 20, 0, 0])
dome();
