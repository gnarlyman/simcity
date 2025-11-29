# Visual & Tile Specifications

## Overview

This document specifies all visual assets required for the SimCity clone, including tile dimensions, sprite requirements, color palettes, and art style guidelines.

## Art Style Guidelines

### Visual Direction

The game aims for a **clean, stylized isometric** look inspired by classic city builders:

- Clear, readable shapes at all zoom levels
- Distinct color coding for zone types
- Consistent lighting direction (top-left light source)
- Soft shadows for depth
- Vibrant but not oversaturated colors

### Reference Style
- SimCity 4 (2003) - primary reference
- OpenTTD - clean isometric tiles
- Banished - cohesive color palette

## Tile Dimensions

### Base Isometric Tile

```
Tile Ratio: 2:1 (width to height)
Base Size: 64 × 32 pixels

                    32px
                     ◄─►
         ┌───────────◆───────────┐
         │          ╱ ╲          │
         │         ╱   ╲         │
         │        ╱     ╲        │ 16px
         │       ╱       ╲       │
    16px ◆──────◆─────────◆──────◆
         │       ╲       ╱       │
         │        ╲     ╱        │
         │         ╲   ╱         │ 16px
         │          ╲ ╱          │
         └───────────◆───────────┘
              64px total width
```

### Size Chart

| Asset Type | Base Width | Base Height | Notes |
|------------|------------|-------------|-------|
| Flat tile | 64 | 32 | Standard ground |
| Sloped tile | 64 | 40-48 | +8-16px for elevation |
| 1×1 building | 64 | 48-96 | Height varies |
| 2×2 building | 128 | 80-160 | Larger footprint |
| 3×3 building | 192 | 112-224 | Large buildings |
| 4×4 building | 256 | 144-288 | Major structures |
| Tree (small) | 16 | 24 | Individual tree |
| Tree (large) | 32 | 48 | Mature tree |
| Vehicle | 32 | 16 | Cars, trucks |

## Color Palette

### Zone Colors

```
RESIDENTIAL (Green Family)
├── Low Density:    #90EE90 (Light Green)
├── Medium Density: #228B22 (Forest Green)
└── High Density:   #006400 (Dark Green)

COMMERCIAL (Blue Family)
├── Low Density:    #ADD8E6 (Light Blue)
├── Medium Density: #4169E1 (Royal Blue)
└── High Density:   #00008B (Dark Blue)

INDUSTRIAL (Yellow/Orange Family)
├── Agriculture:    #F5DEB3 (Wheat)
├── Dirty:          #8B4513 (Saddle Brown)
├── Manufacturing:  #FFD700 (Gold)
└── High-Tech:      #20B2AA (Light Sea Green)
```

### Terrain Colors

```
GRASS
├── Light:  #7CBA5F
├── Medium: #5A9A3D
└── Dark:   #3D7A27

DIRT
├── Light:  #C4A87C
├── Medium: #A68B5B
└── Dark:   #8B7355

ROCK
├── Light:  #9E9E9E
├── Medium: #757575
└── Dark:   #616161

SAND
├── Light:  #F4E4BC
├── Medium: #E8D4A2
└── Dark:   #D4C088

WATER
├── Shallow: #5DADE2
├── Medium:  #3498DB
└── Deep:    #1A5276
```

### Building Colors by Wealth

```
LOW WEALTH (§)
├── Roof:   #A67C52 (Brown)
├── Walls:  #D4C4B4 (Beige)
└── Accent: #8B7355 (Dark Brown)

MEDIUM WEALTH (§§)
├── Roof:   #708090 (Slate Gray)
├── Walls:  #F5F5F5 (White Smoke)
└── Accent: #4682B4 (Steel Blue)

HIGH WEALTH (§§§)
├── Roof:   #2F4F4F (Dark Slate)
├── Walls:  #FFFFFF (White)
└── Accent: #B8860B (Dark Goldenrod)
```

### UI Colors

```
BACKGROUND
├── Dark:    #1A1A2E
├── Panel:   #16213E
└── Accent:  #0F3460

TEXT
├── Primary:   #FFFFFF
├── Secondary: #A0A0A0
└── Highlight: #E94560

BUTTONS
├── Normal:  #0F3460
├── Hover:   #1A4A7A
├── Active:  #E94560
└── Disabled: #404040
```

## Terrain Tiles

### Flat Terrain Variants

Each surface type needs these flat variants:

| Surface | Variants | Total Tiles |
|---------|----------|-------------|
| Grass | Light, Medium, Dark, Transition × 4 | 7 |
| Dirt | Light, Medium, Dark, Transition × 4 | 7 |
| Rock | Light, Medium, Dark | 3 |
| Sand | Light, Medium, Dark, Beach × 4 | 7 |

### Slope Tiles

For each surface type:

```
Cardinal Slopes (4)
├── North slope
├── South slope
├── East slope
└── West slope

Inner Corners (4)
├── Northeast inner
├── Northwest inner
├── Southeast inner
└── Southwest inner

Outer Corners (4)
├── Northeast outer
├── Northwest outer
├── Southeast outer
└── Southwest outer

Cliff Faces (4)
├── North cliff
├── South cliff
├── East cliff
└── West cliff

Total per surface: 16 slope variations
```

### Water Tiles

```
WATER TILES
├── Open water (4 animation frames)
├── Shore - North
├── Shore - South
├── Shore - East
├── Shore - West
├── Shore corners (4 inner, 4 outer)
├── River straight (2 orientations)
├── River corner (4 orientations)
└── River end (4 orientations)

Total: ~25 base tiles + animation frames
```

## Road Tiles

### Street Network

```
ROAD PIECES (per road type: Street, Road, Avenue)
├── Straight NS
├── Straight EW
├── Corner NE
├── Corner NW
├── Corner SE
├── Corner SW
├── T-intersection (4 orientations)
├── 4-way intersection
├── End cap (4 orientations)
├── Bridge segment
└── Tunnel entrance (4 orientations)

Road types: Street, Road, Avenue, One-way, Highway
Total: ~15 pieces × 5 types = 75 tiles
```

### Auto-Tiling Bitmask

Roads use a 4-bit bitmask for connections:

```
Bit positions:
    N
    │
W ──┼── E
    │
    S

N = bit 0 (1)
E = bit 1 (2)
S = bit 2 (4)
W = bit 3 (8)

Examples:
- Straight NS: 0101 (5)
- Corner NE:   0011 (3)
- T-south:     1011 (11)
- 4-way:       1111 (15)
```

## Building Sprites

### Residential Buildings

```
LOW DENSITY RESIDENTIAL (R§)
├── Small house (1×1) - 3 styles × 3 stages = 9
├── Medium house (1×2) - 3 styles × 3 stages = 9
├── Large house (2×2) - 3 styles × 3 stages = 9
├── Duplex (2×1) - 2 styles × 3 stages = 6
└── Abandoned variants × 3 = 3
Total: 36 sprites

MEDIUM DENSITY RESIDENTIAL (R§§)
├── Townhouse row (2×1) - 4 styles × 3 stages = 12
├── Low-rise apartment (2×2) - 4 styles × 3 stages = 12
├── Mid-rise apartment (2×3) - 3 styles × 3 stages = 9
└── Abandoned variants × 4 = 4
Total: 37 sprites

HIGH DENSITY RESIDENTIAL (R§§§)
├── High-rise apartment (3×3) - 4 styles × 3 stages = 12
├── Condo tower (2×2) - 4 styles × 3 stages = 12
├── Luxury tower (3×4) - 3 styles × 3 stages = 9
└── Abandoned variants × 4 = 4
Total: 37 sprites
```

### Commercial Buildings

```
LOW DENSITY COMMERCIAL (C§)
├── Small shop (1×1) - 6 styles = 6
├── Gas station (2×1) - 2 styles = 2
├── Convenience store (1×2) - 3 styles = 3
├── Strip mall (3×1) - 2 styles = 2
└── Abandoned × 2 = 2
Total: 15 sprites

MEDIUM DENSITY COMMERCIAL (C§§)
├── Office building (2×2) - 4 styles × 3 stages = 12
├── Shopping center (3×2) - 3 styles × 2 stages = 6
├── Hotel (2×3) - 3 styles × 3 stages = 9
└── Abandoned × 3 = 3
Total: 30 sprites

HIGH DENSITY COMMERCIAL (C§§§)
├── Office tower (3×3) - 4 styles × 3 stages = 12
├── Corporate HQ (4×4) - 3 styles × 3 stages = 9
├── Skyscraper (3×4) - 4 styles × 3 stages = 12
└── Abandoned × 3 = 3
Total: 36 sprites
```

### Industrial Buildings

```
AGRICULTURE (I-A)
├── Small farm (4×4) - 4 crop types = 4
├── Large farm (6×6) - 4 crop types = 4
├── Orchard (4×4) - 2 types = 2
├── Barn (2×2) - 2 styles = 2
├── Silo (1×1) - 1
└── Abandoned × 2 = 2
Total: 15 sprites

DIRTY INDUSTRY (I-D)
├── Factory (3×3) - 4 styles × 2 stages = 8
├── Warehouse (4×2) - 3 styles = 3
├── Refinery (4×4) - 2 styles = 2
├── Smokestack (1×1) - 3 variants = 3
└── Abandoned × 3 = 3
Total: 19 sprites

MANUFACTURING (I-M)
├── Assembly plant (4×4) - 3 styles × 2 stages = 6
├── Processing plant (3×3) - 3 styles × 2 stages = 6
├── Distribution center (4×3) - 2 styles = 2
└── Abandoned × 2 = 2
Total: 16 sprites

HIGH-TECH (I-HT)
├── Tech campus (4×4) - 3 styles × 2 stages = 6
├── Research lab (3×3) - 3 styles × 2 stages = 6
├── Data center (3×2) - 2 styles = 2
├── Clean room (2×2) - 2 styles = 2
└── Abandoned × 2 = 2
Total: 18 sprites
```

### Civic Buildings

```
UTILITIES
├── Coal power plant (4×4)
├── Oil power plant (4×4)
├── Gas power plant (3×3)
├── Nuclear power plant (4×4)
├── Wind turbine (1×1)
├── Solar panel array (2×2)
├── Water pump (2×2)
├── Water tower (1×1)
├── Water treatment (3×3)
├── Landfill (4×4) - 4 fill stages
├── Incinerator (3×3)
├── Recycling center (3×3)
├── Power lines (15 configurations)
├── Water pipes (15 configurations)
Total: ~45 sprites

PUBLIC SERVICES
├── Police station (2×2)
├── Police HQ (3×3)
├── Fire station (2×2)
├── Fire HQ (3×3)
├── Hospital (4×4)
├── Clinic (2×2)
├── Elementary school (3×3)
├── High school (4×4)
├── College (5×5)
├── Library (2×2)
├── Museum (3×3)
├── Jail (3×3)
Total: 12 sprites

TRANSPORTATION
├── Bus stop (1×1)
├── Bus depot (3×2)
├── Subway station (2×2)
├── Elevated rail station (2×2)
├── Train station (4×2)
├── Freight depot (4×3)
├── Seaport (6×4)
├── Airport (8×6)
├── Parking lot (2×2)
├── Parking garage (2×2)
Total: 10 sprites

PARKS & RECREATION
├── Small park (1×1) - 4 styles
├── Medium park (2×2) - 4 styles
├── Large park (3×3) - 3 styles
├── Plaza (2×2) - 3 styles
├── Fountain (1×1)
├── Playground (2×2)
├── Sports field (4×3)
├── Stadium (6×4)
Total: ~20 sprites
```

## Animation Specifications

### Water Animation

```
Frames: 4
Frame duration: 250ms
Total cycle: 1000ms
Animation: Subtle wave/shimmer effect
```

### Building Construction

```
Frames: 3 stages
Duration: Variable (based on simulation)
Stage 1: Foundation/scaffolding
Stage 2: Partial structure
Stage 3: Complete building
```

### Vehicle Movement

```
Vehicle types:
├── Car (8 directions)
├── Bus (8 directions)
├── Truck (8 directions)
├── Train (4 directions)
└── Plane (8 directions)

Directions: N, NE, E, SE, S, SW, W, NW
Frame size: 32×16 pixels
```

### Effects

```
SMOKE/POLLUTION
├── Small smoke puff (4 frames)
├── Industrial chimney smoke (6 frames)
└── Vehicle exhaust (3 frames)

FIRE
├── Building fire (6 frames)
├── Grass fire (4 frames)
└── Fire spread effect

CONSTRUCTION
├── Crane animation (4 frames)
├── Dust cloud (3 frames)
```

## UI Elements

### Toolbar Icons

```
Size: 32×32 pixels

Tool icons:
├── Select/Query
├── Bulldoze
├── Zone R (3 densities)
├── Zone C (3 densities)
├── Zone I
├── Roads menu
├── Rail menu
├── Power
├── Water
├── Services
├── Parks
├── Rewards
├── Ordinances
```

### Data Overlay Icons

```
Size: 24×24 pixels

Overlay toggles:
├── Zoning
├── Desirability
├── Land value
├── Crime
├── Pollution (air)
├── Pollution (water)
├── Traffic
├── Power grid
├── Water network
├── Fire coverage
├── Police coverage
├── Health coverage
├── Education
```

### Status Icons

```
Size: 16×16 pixels

Building status:
├── No power
├── No water
├── High crime
├── On fire
├── Abandoned
├── Under construction
├── Historic
├── Landmark
```

## Sprite Sheet Organization

### Recommended Sheet Layout

```
terrain.png (1024×1024)
├── Grass tiles (0,0) to (512,256)
├── Dirt tiles (512,0) to (1024,256)
├── Water tiles (0,256) to (512,512)
├── Rock/sand (512,256) to (1024,512)
└── Transitions (0,512) to (1024,1024)

roads.png (1024×512)
├── Streets (0,0) to (512,256)
├── Roads (512,0) to (1024,256)
└── Highways (0,256) to (1024,512)

buildings_residential.png (2048×2048)
buildings_commercial.png (2048×2048)
buildings_industrial.png (2048×2048)
buildings_civic.png (2048×2048)

ui.png (512×512)
├── Toolbar icons
├── Status icons
└── Overlay icons
```

## Export Settings

### File Format

- **Format**: PNG-32 (with alpha)
- **Color space**: sRGB
- **Compression**: Maximum

### Naming Convention

```
{category}_{type}_{variant}_{state}.png

Examples:
- terrain_grass_flat_light.png
- building_house_small_stage1.png
- road_street_corner_ne.png
- ui_icon_zone_residential.png
```

## Development Placeholders

For initial development, use procedurally generated graphics:

```typescript
// Placeholder tile generator
function generatePlaceholderTile(
  width: number,
  height: number,
  color: number,
  label?: string
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d')!;
  
  // Draw isometric diamond
  ctx.beginPath();
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width, height / 2);
  ctx.lineTo(width / 2, height);
  ctx.lineTo(0, height / 2);
  ctx.closePath();
  
  ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.stroke();
  
  if (label) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(label, width / 2, height / 2 + 4);
  }
  
  return canvas;
}
