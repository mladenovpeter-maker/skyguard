// ═══════════════════════════════════════════════
//  SKYGUARD — DOME ENCLOSURE
//  Референция: снимка — чист, гладък, без нищо отвън
//  Купол се обръща върху основата, силиконово уплътнение
//  Scaled за Bambu P1S (256mm): 230×90mm × 142mm
// ═══════════════════════════════════════════════

$fn = 128;
epsilon = 0.01;

// ── Размери ──────────────────────────────────────
rx     = 115;   // X радиус → 230mm ширина
ry     = 45;    // Y радиус → 90mm дълбочина
dome_h = 102;   // Височина на купола
base_h = 40;    // Височина на основата
wall   = 4;     // Дебелина стени

// ── Монтажна плоча ───────────────────────────────
plate_x  = rx + 20;
plate_y  = ry + 20;
plate_h  = 8;
corner_r = 10;

// ── Цветове ──────────────────────────────────────
dome_color  = "WhiteSmoke";
base_color  = "#1e1e1e";
plate_color = "#141414";

// ════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════

module upper_half_ellipsoid(ex, ey, ez) {
    intersection() {
        scale([ex, ey, ez]) sphere(r = 1);
        cylinder(h = ez + 1, r = max(ex, ey) + 1);
    }
}

module ecyl(h, ex, ey) {
    scale([ex, ey, 1]) cylinder(h = h, r = 1);
}

// ════════════════════════════════════════════════
//  КУПОЛ — бял ASA, RF прозрачен
//  Гладка черупка, НИЩО отвън
// ════════════════════════════════════════════════
module dome() {
    color(dome_color)
    difference() {
        upper_half_ellipsoid(rx, ry, dome_h);
        translate([0, 0, wall])
        upper_half_ellipsoid(rx - wall, ry - wall, dome_h - wall);
    }
}

// ════════════════════════════════════════════════
//  ОСНОВА — черен ASA
//  Гладък цилиндър, НИЩО отвън
// ════════════════════════════════════════════════
module base() {
    color(base_color)
    difference() {
        ecyl(base_h, rx, ry);
        translate([0, 0, wall])
        ecyl(base_h + epsilon, rx - wall, ry - wall);
    }
}

// ════════════════════════════════════════════════
//  МОНТАЖНА ПЛОЧА — черна, долу
//  Проста плоча с заоблени ъгли
// ════════════════════════════════════════════════
module mount_plate() {
    color(plate_color)
    translate([0, 0, -plate_h])
    hull() {
        for (sx = [-1, 1]) for (sy = [-1, 1])
        translate([sx * (plate_x - corner_r), sy * (plate_y - corner_r), 0])
        cylinder(h = plate_h, r = corner_r);
    }
}

// ════════════════════════════════════════════════
//  СГЛОБКА
// ════════════════════════════════════════════════
mount_plate();
base();
translate([0, 0, base_h]) dome();
