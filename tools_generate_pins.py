import json
import math
import random
from pathlib import Path

"""Eldralore Atlas - pin generator (v3.1 refined)

Outputs: data/pins.json
Inputs : data/zones.json, data/config.json

Design goals:
- Deterministic generation (seeded) so the map is stable between runs.
- Respect layers and territories (polygons) strictly.
- Apply strategic distribution for fortresses:
  * 20% in the "central" region of the territory
  * 80% close to borders (frontier feeling)
- Keep temples: at least 2 per territory.

Notes:
- All coordinates are percent-based (0-100) to match the UI.
- If a territory polygon is too small, the generator will place fewer spaced points.
"""

ROOT = Path(__file__).resolve().parent
ZONES_PATH = ROOT / 'data' / 'zones.json'
CONFIG_PATH = ROOT / 'data' / 'config.json'
PINS_PATH = ROOT / 'data' / 'pins.json'


# ---------------- Geometry helpers ----------------

def point_in_poly(x: float, y: float, poly):
    """Ray casting."""
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        denom = (yj - yi) or 1e-12
        intersect = ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / denom + xi)
        if intersect:
            inside = not inside
        j = i
    return inside


def bbox(poly):
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    return min(xs), min(ys), max(xs), max(ys)


def centroid(poly):
    # polygon centroid (fallback to average)
    a = 0.0
    cx = 0.0
    cy = 0.0
    n = len(poly)
    for i in range(n):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % n]
        cross = x0 * y1 - x1 * y0
        a += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    if abs(a) < 1e-9:
        return (sum(p[0] for p in poly) / n, sum(p[1] for p in poly) / n)
    a *= 0.5
    cx /= (6.0 * a)
    cy /= (6.0 * a)
    return (cx, cy)


def dist_point_to_segment(px, py, ax, ay, bx, by):
    # projection on segment
    abx = bx - ax
    aby = by - ay
    apx = px - ax
    apy = py - ay
    ab2 = abx * abx + aby * aby
    if ab2 <= 1e-12:
        return math.hypot(px - ax, py - ay)
    t = (apx * abx + apy * aby) / ab2
    t = max(0.0, min(1.0, t))
    cx = ax + t * abx
    cy = ay + t * aby
    return math.hypot(px - cx, py - cy)


def dist_to_poly_edges(px, py, poly):
    n = len(poly)
    best = 1e9
    for i in range(n):
        ax, ay = poly[i]
        bx, by = poly[(i + 1) % n]
        best = min(best, dist_point_to_segment(px, py, ax, ay, bx, by))
    return best


def sample_point_in_polys(rng: random.Random, polys, accept_fn=None, max_tries=20000):
    # Choose polygon weighted by bbox area (cheap proxy)
    bbs = [bbox(p) for p in polys]
    weights = [(bb[2] - bb[0]) * (bb[3] - bb[1]) for bb in bbs]
    total = sum(weights) or 1.0
    r = rng.random() * total
    acc = 0.0
    idx = 0
    for i, w in enumerate(weights):
        acc += w
        if r <= acc:
            idx = i
            break
    poly = polys[idx]
    x0, y0, x1, y1 = bbs[idx]

    for _ in range(max_tries):
        x = rng.uniform(x0, x1)
        y = rng.uniform(y0, y1)
        if not point_in_poly(x, y, poly):
            continue
        if accept_fn and not accept_fn(x, y, poly):
            continue
        return float(x), float(y), poly

    # fallback: pick a vertex
    vx, vy = rng.choice(poly)
    return float(vx), float(vy), poly


def sample_points_spaced(rng: random.Random, polys, n: int, min_dist_pct: float, accept_fn=None, max_tries_each=6000):
    """Rejection-sample n points with minimum euclidean distance (in percentage units)."""
    pts = []
    tries = 0
    while len(pts) < n and tries < n * max_tries_each:
        tries += 1
        x, y, _poly = sample_point_in_polys(rng, polys, accept_fn=accept_fn)
        ok = True
        for px, py in pts:
            if math.hypot(x - px, y - py) < min_dist_pct:
                ok = False
                break
        if ok:
            pts.append((x, y))
    return pts


# ---------------- Zones / layers ----------------

def ensure_layers(zones: dict):
    for k in ['world', 'underground', 'sky', 'subaquatica', 'abismo']:
        zones.setdefault(k, {})

    # Move Nagas to subaquatica
    if 'nagas' in zones.get('world', {}):
        zones['subaquatica']['nagas'] = zones['world'].pop('nagas')

    # Move Demons to abismo
    if 'demons' in zones.get('world', {}):
        zones['abismo']['demons'] = zones['world'].pop('demons')


def find_territory_for_point(zones_layer: dict, x: float, y: float):
    for terr, polys in zones_layer.items():
        for poly in polys:
            if point_in_poly(x, y, poly):
                return terr
    return None


# ---------------- Pin helpers ----------------

def add_pin(pins, *, pid, name, layer, ptype, group, territory, x, y, description=''):
    pins.append({
        'id': pid,
        'name': name,
        'layer': layer,
        'type': ptype,
        'group': group,
        'territory': territory,
        'x': round(float(x), 2),
        'y': round(float(y), 2),
        'description': description,
        'images': [],
        'videos': [],
        'details': '',
        'alwaysLabel': False
    })


def distribute_settlements_total(territories, fixed, total, weights, min_per_race):
    """Allocate (total - sum(fixed)) across territories proportionally by weights, with minimums."""
    remaining = total - sum(fixed.get(t, 0) for t in territories)
    remaining = max(0, remaining)

    alloc = {t: fixed.get(t, 0) for t in territories}

    # Start with minimums (excluding fixed territories like angels if already set)
    for t in territories:
        if t in fixed:
            continue
        alloc[t] = max(alloc[t], min_per_race)
    remaining = total - sum(alloc.values())
    remaining = max(0, remaining)

    # Weighted distribution
    wsum = sum(weights.get(t, 1.0) for t in territories if t not in fixed) or 1.0
    floats = {}
    for t in territories:
        if t in fixed:
            continue
        floats[t] = (weights.get(t, 1.0) / wsum) * remaining

    # Base floor
    for t, f in floats.items():
        add = int(math.floor(f))
        alloc[t] += add
        floats[t] = f - add

    # Distribute remainder
    rem = total - sum(alloc.values())
    if rem > 0:
        for t in sorted(floats.keys(), key=lambda k: floats[k], reverse=True):
            if rem <= 0:
                break
            alloc[t] += 1
            rem -= 1

    # Final sanity: trim if overflow
    while sum(alloc.values()) > total:
        # reduce from the largest non-fixed
        candidates = [t for t in territories if t not in fixed and alloc[t] > min_per_race]
        if not candidates:
            break
        t = max(candidates, key=lambda k: alloc[k])
        alloc[t] -= 1

    return alloc


def make_fortress_acceptor(polys, want_center: bool, center_ratio: float, border_max_dist: float):
    """
    want_center=True  -> accept points near centroid (within center_ratio * radius)
    want_center=False -> accept points near border (edge distance <= border_max_dist)
    """
    # Use centroid of a representative poly (when multiple polys exist, we accept based on selected poly)
    def accept(x, y, poly):
        if want_center:
            cx, cy = centroid(poly)
            # radius proxy: max dist from centroid to poly vertices
            rad = max(math.hypot(vx - cx, vy - cy) for vx, vy in poly) or 1.0
            return math.hypot(x - cx, y - cy) <= (center_ratio * rad)
        else:
            return dist_to_poly_edges(x, y, poly) <= border_max_dist
    return accept


# ---------------- Main ----------------

def main():
    zones = json.loads(ZONES_PATH.read_text('utf-8'))
    config = json.loads(CONFIG_PATH.read_text('utf-8'))
    counts = config.get('counts', {})

    ensure_layers(zones)
    # Persist moves (nagas/demons)
    ZONES_PATH.write_text(json.dumps(zones, indent=2, ensure_ascii=False), 'utf-8')

    seed = int(counts.get('seed', 42))
    rng = random.Random(seed)

    TERRITORIES = [
        'humans', 'elves', 'dwarves', 'vampires', 'orcs', 'nagas', 'centaurs', 'dragons',
        'demons', 'fae', 'giants', 'gnomes', 'undead', 'angels'
    ]

    NATIVE_LAYER = {
        'humans': 'world',
        'elves': 'world',
        'vampires': 'world',
        'orcs': 'world',
        'centaurs': 'world',
        'dragons': 'world',
        'fae': 'world',
        'giants': 'world',
        'gnomes': 'world',
        'nagas': 'subaquatica',
        'undead': 'underground',
        'angels': 'sky',
        'demons': 'abismo',
        'dwarves': 'world',  # split later
    }

    def polys_for(territory: str, layer: str):
        return zones.get(layer, {}).get(territory, [])

    naga_polys = polys_for('nagas', 'subaquatica')

    settlements_total = int(counts.get('settlements_total', 120))
    settlements_min_per_race = int(counts.get('settlements_min_per_race', 4))
    angels_settlements = int(counts.get('angels_settlements', 8))

    guild_per_race = int(counts.get('guild_per_race', 1))

    fort_default = int(counts.get('fortresses_default_per_race', 6))
    fort_over = counts.get('fortresses_overrides', {}) or {}

    dungeons_per_race = int(counts.get('dungeons_per_race', 6))
    abyss_dungeons_per_race = int(counts.get('abyss_dungeons_per_race', 1))

    temples_total = int(counts.get('temples_total', 30))
    temples_min_per_race = int(counts.get('temples_min_per_race', 2))

    max_pins = int(counts.get('max_pins', 480))

    # Weights: start from v3 spirit (roughly equal), but keep dwarves slightly higher due to split.
    weights = {t: 1.0 for t in TERRITORIES}
    weights['dwarves'] = 1.1

    fixed = {'angels': angels_settlements}
    settlements_alloc = distribute_settlements_total(
        territories=TERRITORIES,
        fixed=fixed,
        total=settlements_total,
        weights=weights,
        min_per_race=settlements_min_per_race
    )

    # Fortress counts per territory
    fortress_counts = {}
    for t in TERRITORIES:
        fortress_counts[t] = int(fort_over.get(t, fort_default))

    # Quick cap sanity: if someone changes config later, keep within max_pins by trimming settlements only.
    def estimate_total():
        est = 0
        est += sum(settlements_alloc.values())
        est += guild_per_race * len(TERRITORIES)
        est += sum(fortress_counts.values())
        est += dungeons_per_race * len(TERRITORIES)
        est += abyss_dungeons_per_race * len(TERRITORIES)
        est += temples_total
        return est

    while estimate_total() > max_pins:
        # Reduce settlements from largest non-angels first
        cands = [t for t in TERRITORIES if t != 'angels' and settlements_alloc[t] > settlements_min_per_race]
        if not cands:
            break
        t = max(cands, key=lambda k: settlements_alloc[k])
        settlements_alloc[t] -= 1

    pins = []

    # ------------------- Fortresses (20% center, 80% border) -------------------
    # Heuristics: center_ratio controls how deep \"central\" is; border_max_dist controls border band thickness
    CENTER_RATIO = 0.35
    BORDER_MAX_DIST = 0.85  # percentage units distance to edge

    fortress_points_by_territory = {t: [] for t in TERRITORIES}

    for terr in TERRITORIES:
        n = fortress_counts.get(terr, 0)
        if n <= 0:
            continue

        # Dwarves: split across world/underground if underground polygons exist
        if terr == 'dwarves':
            # split roughly half; favor underground if possible
            nw = n // 2
            nu = n - nw
            for layer, cnt in [('world', nw), ('underground', nu)]:
                polys = polys_for('dwarves', layer)
                if not polys or cnt <= 0:
                    continue
                n_center = max(0, int(round(cnt * 0.2)))
                n_border = cnt - n_center

                # center forts
                pts_c = sample_points_spaced(
                    rng, polys, n_center, min_dist_pct=1.8,
                    accept_fn=make_fortress_acceptor(polys, True, CENTER_RATIO, BORDER_MAX_DIST),
                )
                # border forts
                pts_b = sample_points_spaced(
                    rng, polys, n_border, min_dist_pct=1.8,
                    accept_fn=make_fortress_acceptor(polys, False, CENTER_RATIO, BORDER_MAX_DIST),
                )

                all_pts = pts_c + pts_b
                for i, (x, y) in enumerate(all_pts, 1):
                    add_pin(
                        pins,
                        pid=f'{terr}_{layer}_fort_{i:03d}',
                        name=f'Anões — Fortaleza {i:02d}',
                        layer=layer,
                        ptype='fortress',
                        group=terr,
                        territory=terr,
                        x=x, y=y,
                        description='Fortaleza (placeholder).'
                    )
                    fortress_points_by_territory[terr].append((x, y))
            continue

        layer = NATIVE_LAYER[terr]
        polys = polys_for(terr, layer)
        if not polys:
            continue

        n_center = max(0, int(round(n * 0.2)))
        n_border = n - n_center

        pts_c = sample_points_spaced(
            rng, polys, n_center, min_dist_pct=1.8,
            accept_fn=make_fortress_acceptor(polys, True, CENTER_RATIO, BORDER_MAX_DIST),
        )
        pts_b = sample_points_spaced(
            rng, polys, n_border, min_dist_pct=1.8,
            accept_fn=make_fortress_acceptor(polys, False, CENTER_RATIO, BORDER_MAX_DIST),
        )

        all_pts = pts_c + pts_b
        for i, (x, y) in enumerate(all_pts, 1):
            add_pin(
                pins,
                pid=f'{terr}_{layer}_fort_{i:03d}',
                name=f'{terr.capitalize()} — Fortaleza {i:02d}',
                layer=layer,
                ptype='fortress',
                group=terr,
                territory=terr,
                x=x, y=y,
                description='Fortaleza (placeholder).'
            )
            fortress_points_by_territory[terr].append((x, y))

    # ------------------- Settlements (total 120, some near fortresses) -------------------
    MIN_DIST_SETT = 2.2

    def generate_settlements_for(polys, n, near_points, min_dist):
        """Generate settlements with some points clustered near fortresses."""
        if n <= 0:
            return []

        # Aim: up to one settlement near each fortress, capped at 35% of settlements.
        near_cap = min(len(near_points), max(0, int(round(n * 0.35))))

        pts = []

        # 1) Place near-fortress settlements first
        near_radius = 1.2  # % units
        for i in range(near_cap):
            fx, fy = near_points[i]

            def accept_near(x, y, _poly):
                return math.hypot(x - fx, y - fy) <= near_radius

            x, y, _ = sample_point_in_polys(rng, polys, accept_fn=accept_near)
            # Respect spacing among near points
            if all(math.hypot(x - px, y - py) >= min_dist for px, py in pts):
                pts.append((x, y))

        # 2) Place remaining settlements spaced normally
        remaining = n - len(pts)
        if remaining <= 0:
            return pts

        # sample spaced points, then merge respecting distance to existing
        candidates = sample_points_spaced(rng, polys, remaining * 2, min_dist)
        for x, y in candidates:
            if len(pts) >= n:
                break
            if all(math.hypot(x - px, y - py) >= min_dist for px, py in pts):
                pts.append((x, y))

        return pts

    for terr in TERRITORIES:
        n = settlements_alloc.get(terr, 0)
        if n <= 0:
            continue

        if terr == 'dwarves':
            # split across world/underground roughly half, but only if polygons exist
            nw = n // 2
            nu = n - nw
            # world
            polys_w = polys_for('dwarves', 'world')
            if polys_w and nw > 0:
                pts = generate_settlements_for(polys_w, nw, fortress_points_by_territory['dwarves'], MIN_DIST_SETT)
                for i, (x, y) in enumerate(pts, 1):
                    add_pin(
                        pins,
                        pid=f'dwarves_world_set_{i:03d}',
                        name=f'Anões — Assentamento {i:02d}',
                        layer='world',
                        ptype='settlement',
                        group='dwarves',
                        territory='dwarves',
                        x=x, y=y,
                        description='Assentamento anão (placeholder).'
                    )
            # underground
            polys_u = polys_for('dwarves', 'underground')
            if polys_u and nu > 0:
                pts = generate_settlements_for(polys_u, nu, fortress_points_by_territory['dwarves'], MIN_DIST_SETT)
                for i, (x, y) in enumerate(pts, 1):
                    add_pin(
                        pins,
                        pid=f'dwarves_und_set_{i:03d}',
                        name=f'Anões — Subterrâneo {i:02d}',
                        layer='underground',
                        ptype='settlement',
                        group='dwarves',
                        territory='dwarves',
                        x=x, y=y,
                        description='Assentamento anão subterrâneo (placeholder).'
                    )
            continue

        layer = NATIVE_LAYER[terr]
        polys = polys_for(terr, layer)
        if not polys:
            continue

        pts = generate_settlements_for(polys, n, fortress_points_by_territory[terr], MIN_DIST_SETT)
        for i, (x, y) in enumerate(pts, 1):
            label = 'Cidade Aérea' if terr == 'angels' else ('Enclave Subaquático' if terr == 'nagas' else 'Assentamento')
            add_pin(
                pins,
                pid=f'{terr}_{layer}_set_{i:03d}',
                name=f'{terr.capitalize()} — {label} {i:02d}',
                layer=layer,
                ptype='settlement',
                group=terr,
                territory=terr,
                x=x, y=y,
                description='Local gerado automaticamente (placeholder).'
            )

    # ------------------- Guild HQ (1 per territory) -------------------
    for terr in TERRITORIES:
        if guild_per_race <= 0:
            continue

        if terr == 'dwarves':
            # put the dwarven guild in world by default
            layer = 'world' if polys_for('dwarves', 'world') else 'underground'
            polys = polys_for('dwarves', layer)
        else:
            layer = NATIVE_LAYER[terr]
            polys = polys_for(terr, layer)

        if not polys:
            continue

        x, y, _ = sample_point_in_polys(rng, polys)
        add_pin(
            pins,
            pid=f'{terr}_{layer}_guild_001',
            name=f'{terr.capitalize()} — Sede da Guilda',
            layer=layer,
            ptype='guild_hq',
            group=terr,
            territory=terr,
            x=x, y=y,
            description='Sede principal da Guilda de Aventureiros (placeholder).'
        )

    # ------------------- Dungeons (6 per territory in native layer) -------------------
    MIN_DIST_DUN = 1.6

    for terr in TERRITORIES:
        n = dungeons_per_race
        if n <= 0:
            continue

        if terr == 'dwarves':
            # split between world/underground
            nw = n // 2
            nu = n - nw
            for layer, cnt in [('world', nw), ('underground', nu)]:
                polys = polys_for('dwarves', layer)
                if not polys or cnt <= 0:
                    continue
                pts = sample_points_spaced(rng, polys, cnt, MIN_DIST_DUN)
                for i, (x, y) in enumerate(pts, 1):
                    add_pin(
                        pins,
                        pid=f'{terr}_{layer}_dun_{i:03d}',
                        name=f'Anões — Masmorra {i:02d}',
                        layer=layer,
                        ptype='dungeon',
                        group=terr,
                        territory=terr,
                        x=x, y=y,
                        description='Masmorra (placeholder).'
                    )
            continue

        if terr == 'angels':
            # Sample INSIDE sky polygons, but display on world unless overlapping naga => subaquatica
            sky_polys = polys_for('angels', 'sky')
            if not sky_polys:
                continue
            pts = sample_points_spaced(rng, sky_polys, n, MIN_DIST_DUN)
            for i, (x, y) in enumerate(pts, 1):
                # If point also lies in naga area, it is over sea => subaquatica
                is_naga = any(point_in_poly(x, y, poly) for poly in naga_polys) if naga_polys else False
                layer = 'subaquatica' if is_naga else 'world'
                add_pin(
                    pins,
                    pid=f'{terr}_world_dun_{i:03d}',
                    name=f'Anjos — Ruína Celeste {i:02d}',
                    layer=layer,
                    ptype='dungeon',
                    group=terr,
                    territory=terr,
                    x=x, y=y,
                    description='Ruína/marco de origem celestial (placeholder).'
                )
            continue

        layer = NATIVE_LAYER[terr]
        polys = polys_for(terr, layer)
        if not polys:
            continue
        pts = sample_points_spaced(rng, polys, n, MIN_DIST_DUN)
        for i, (x, y) in enumerate(pts, 1):
            add_pin(
                pins,
                pid=f'{terr}_{layer}_dun_{i:03d}',
                name=f'{terr.capitalize()} — Masmorra {i:02d}',
                layer=layer,
                ptype='dungeon',
                group=terr,
                territory=terr,
                x=x, y=y,
                description='Masmorra (placeholder).'
            )

    # ------------------- Abyss dungeons (1 per territory, abismo only) -------------------
    for terr in TERRITORIES:
        for i in range(abyss_dungeons_per_race):
            ab_polys = zones.get('abismo', {}).get('demons', None)
            if not ab_polys:
                continue
            x, y, _ = sample_point_in_polys(rng, ab_polys)
            add_pin(
                pins,
                pid=f'{terr}_abismo_dun_{i+1:03d}',
                name=f'Abismo — Fenda {race_name(terr)} {i+1:02d}',
                layer='abismo',
                ptype='dungeon',
                group=terr,
                territory=terr,
                x=x, y=y,
                description='Masmorra exclusiva do Abismo (placeholder).'
            )

    # ------------------- Temples (min 2 per territory, total 30) -------------------
    # First, place the guaranteed minimum per territory.
    temple_pins = []
    temple_counts = {t: 0 for t in TERRITORIES}

    def place_temple_for(terr, layer, polys, idx):
        x, y, _ = sample_point_in_polys(rng, polys)
        pid = f'{terr}_{layer}_temple_{idx:03d}'
        add_pin(
            temple_pins,
            pid=pid,
            name=f'{race_name(terr)} — Templo Antigo {idx:02d}',
            layer=layer,
            ptype='temple',
            group=terr,
            territory=terr,
            x=x, y=y,
            description='Templo antigo (placeholder).'
        )
        temple_counts[terr] += 1

    for terr in TERRITORIES:
        needed = temples_min_per_race
        if terr == 'dwarves':
            # Prefer split: 1 world + 1 underground (if possible)
            placed = 0
            if polys_for('dwarves', 'world') and placed < needed:
                place_temple_for('dwarves', 'world', polys_for('dwarves', 'world'), placed + 1)
                placed += 1
            if polys_for('dwarves', 'underground') and placed < needed:
                place_temple_for('dwarves', 'underground', polys_for('dwarves', 'underground'), placed + 1)
                placed += 1
            # if still missing, place in whatever exists
            while placed < needed:
                layer = 'world' if polys_for('dwarves', 'world') else 'underground'
                polys = polys_for('dwarves', layer)
                if not polys:
                    break
                place_temple_for('dwarves', layer, polys, placed + 1)
                placed += 1
            continue

        layer = NATIVE_LAYER[terr]
        polys = polys_for(terr, layer)
        if not polys:
            continue
        for k in range(needed):
            place_temple_for(terr, layer, polys, k + 1)

    # Then, place remaining temples (if any) on world, tagging territory if inside.
    remaining = max(0, temples_total - len(temple_pins))
    if remaining > 0:
        world_polys_all = []
        for terr, polys in zones.get('world', {}).items():
            world_polys_all.extend(polys)
        # if no world polys (should not happen), fallback to any layer
        if not world_polys_all:
            world_polys_all = naga_polys or []

        for i in range(remaining):
            x, y, _ = sample_point_in_polys(rng, world_polys_all)
            terr = find_territory_for_point(zones.get('world', {}), x, y)
            terr = terr or 'humans'  # fallback tag for metadata; doesn't affect filters if user selects a race
            add_pin(
                temple_pins,
                pid=f'world_extra_temple_{i+1:03d}',
                name=f'Templo Perdido {i+1:02d}',
                layer='world',
                ptype='temple',
                group=terr,
                territory=terr,
                x=x, y=y,
                description='Templo antigo (placeholder).'
            )

    pins.extend(temple_pins)

    # ------------------- Write pins -------------------
    PINS_PATH.write_text(json.dumps(pins, indent=2, ensure_ascii=False), 'utf-8')
    print(f'Wrote {PINS_PATH} ({len(pins)} pins).')


def race_name(terr: str) -> str:
    mapping = {
        'humans': 'Humanos',
        'elves': 'Elfos',
        'dwarves': 'Anões',
        'vampires': 'Vampiros',
        'orcs': 'Orcs',
        'nagas': 'Nagas',
        'centaurs': 'Centauros',
        'dragons': 'Dragões',
        'demons': 'Demônios',
        'fae': 'Feéricos',
        'giants': 'Gigantes',
        'gnomes': 'Gnomos',
        'undead': 'Mortos-vivos',
        'angels': 'Anjos'
    }
    return mapping.get(terr, terr)


if __name__ == '__main__':
    main()
