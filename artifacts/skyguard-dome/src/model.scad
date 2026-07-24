// ═══════════════════════════════════════════════════════════════
//  DronExit — Oval Dome Enclosure  (две части, 3D печат)
//  Референция: снимка SkyGuard dome
//
//  ВАЖНО: основата е ЕЛИПСОВИДНА, не кръгла!
//    Ширина (отпред): 250 mm  → rx = 125
//    Дълбочина (отстрани): ~190 mm  → ry = 95
//    Обща височина: ~165 mm
//    Купол: ~115 mm (бял, почти сферичен профил)
//    Основа: ~50 mm (черна, леко конична)
// ═══════════════════════════════════════════════════════════════

$fn = 128;
epsilon = 0.01;

// ── Хоризонтални радиуси (елипса в план) ─────────────────────
rx = 125;    // Ширина отпред  → 250 mm
ry =  95;    // Дълбочина      → 190 mm  (НЕ е кръг!)

// ── Купол ─────────────────────────────────────────────────────
dome_rz = 118;   // Вертикален радиус — близо до полусфера
wall    =   3.5; // Дебелина стена

// ── Основа ────────────────────────────────────────────────────
base_h       = 50;   // Височина
base_taper   =  8;   // С колко се стеснява отдолу (rx-taper, ry-taper)

// ── Фланец ────────────────────────────────────────────────────
flange_h   = 10;
flange_gap = 0.3;

// ── Кабелна втулка (M25, изпъкнала надолу) ───────────────────
gland_r_hole = 12.5;
gland_r_boss = 18;
gland_boss_h = 18;

// ── Цветове ───────────────────────────────────────────────────
dome_color = "WhiteSmoke";
base_color = "#1c1c1c";

// ══════════════════════════════════════════════════════════════
//  Горна половина на елипсоид с различни rx, ry, rz
// ══════════════════════════════════════════════════════════════
module upper_ellipsoid(erx, ery, erz) {
    intersection() {
        scale([erx, ery, erz]) sphere(r = 1);
        // Изрязваме само горната половина
        translate([0, 0, -epsilon])
        scale([erx + 1, ery + 1, 1])
        cylinder(h = erz + 1, r = 1);
    }
}

// ══════════════════════════════════════════════════════════════
//  ГОРЕН КУПОЛ — бял
// ══════════════════════════════════════════════════════════════
module dome_part() {
    color(dome_color)
    union() {
        // Черупка
        difference() {
            upper_ellipsoid(rx, ry, dome_rz);
            translate([0, 0, wall])
            upper_ellipsoid(rx - wall, ry - wall, dome_rz - wall);
        }

        // Долен rim — ляга върху основата
        translate([0, 0, -wall])
        linear_extrude(wall + epsilon)
        difference() {
            ellipse_2d(rx, ry);
            ellipse_2d(rx - wall, ry - wall);
        }

        // Male фланец
        translate([0, 0, -flange_h])
        linear_extrude(flange_h)
        difference() {
            ellipse_2d(rx - wall - flange_gap, ry - wall - flange_gap);
            ellipse_2d(rx - 2*wall - flange_gap, ry - 2*wall - flange_gap);
        }
    }
}

// ══════════════════════════════════════════════════════════════
//  ДОЛНА ОСНОВА — черна, елипсовидна, леко конична
// ══════════════════════════════════════════════════════════════
module base_part() {
    color(base_color)
    difference() {
        union() {
            // Конично тяло (елипса, малко по-тясна долу)
            hull() {
                // Горен ръб (= пълна ширина)
                translate([0, 0, base_h - epsilon])
                linear_extrude(epsilon)
                ellipse_2d(rx, ry);

                // Долен ръб (по-тесен)
                translate([0, 0, 0])
                linear_extrude(epsilon)
                ellipse_2d(rx - base_taper, ry - base_taper);
            }

            // Плоско дъно — малка фаска
            translate([0, 0, -2])
            linear_extrude(2 + epsilon)
            ellipse_2d(rx - base_taper - 2, ry - base_taper - 2);

            // Кабелна водачка (цилиндрична — точно като снимката)
            translate([0, 0, -(2 + gland_boss_h)])
            cylinder(h = gland_boss_h + 2 + epsilon, r = gland_r_boss);
        }

        // Кух интериор
        translate([0, 0, wall])
        hull() {
            translate([0, 0, base_h])
            linear_extrude(epsilon)
            ellipse_2d(rx - wall, ry - wall);

            translate([0, 0, 0])
            linear_extrude(epsilon)
            ellipse_2d(rx - base_taper - wall, ry - base_taper - wall);
        }

        // Female гнездо за купола
        translate([0, 0, base_h - flange_h])
        linear_extrude(flange_h + epsilon)
        ellipse_2d(rx - wall, ry - wall);

        // Отвор за кабела
        translate([0, 0, -(2 + gland_boss_h + epsilon)])
        cylinder(h = gland_boss_h + wall + 4 + epsilon, r = gland_r_hole);
    }
}

// ══════════════════════════════════════════════════════════════
//  HELPER: 2D елипса
// ══════════════════════════════════════════════════════════════
module ellipse_2d(a, b) {
    scale([a, b]) circle(r = 1);
}

// ══════════════════════════════════════════════════════════════
//  СГЛОБЕН ИЗГЛЕД
// ══════════════════════════════════════════════════════════════
base_part();

translate([0, 0, base_h])
dome_part();
