# SimCity Clone

A web-based isometric city builder inspired by SimCity 4 Deluxe, built with TypeScript and PixiJS.

## Project Status

🚧 **Early Development** - Documentation phase

## Overview

This project aims to faithfully reproduce the city-building mechanics of SimCity 4 Deluxe's Mayor Mode as a browser-based game. The focus is on authentic simulation behavior, including zoning, RCI demand, transportation, utilities, and city services.

## Features (Planned)

- **Zoning System**: Residential, Commercial, and Industrial zones with density levels
- **RCI Demand Model**: Dynamic supply/demand simulation
- **Transportation**: Roads, highways, rail, mass transit
- **Utilities**: Power plants, water systems, garbage disposal
- **Public Services**: Police, fire, healthcare, education
- **Finance**: Taxes, budgets, ordinances, loans
- **Isometric Rendering**: Classic 2:1 isometric view with WebGL

## Technology Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript 5.x |
| Renderer | PixiJS 8.x |
| Build Tool | Vite 6.x |
| Testing | Vitest + Puppeteer |

## Getting Started

### Prerequisites

- Node.js 20.x or later
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/simcity-clone.git
cd simcity-clone

# Install dependencies
npm install

# Start development server
npm run dev
```

### Development Commands

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Run unit tests
npm test

# Run E2E tests (requires running dev server)
npm run test:e2e

# Type check
npm run typecheck

# Lint
npm run lint
```

## Project Structure

```
/simcity
├── docs/                    # Documentation
│   ├── game-design/         # Game design documents
│   │   ├── 01-overview.md
│   │   ├── 02-terrain-environment.md
│   │   ├── 03-zoning-system.md
│   │   └── 04-rci-demand.md
│   ├── technical/           # Technical specifications
│   │   ├── architecture.md
│   │   └── isometric-rendering.md
│   └── visual/              # Visual specifications
│       └── tile-specifications.md
├── src/                     # Source code
│   ├── core/                # Core engine
│   ├── systems/             # Game systems
│   ├── rendering/           # Rendering
│   ├── ui/                  # User interface
│   └── main.ts              # Entry point
├── public/                  # Static files
├── tests/                   # Test files
└── assets/                  # Game assets
```

## Documentation

### Game Design Documents

| Document | Description |
|----------|-------------|
| [01-overview.md](docs/game-design/01-overview.md) | Project vision and game mechanics overview |
| [02-terrain-environment.md](docs/game-design/02-terrain-environment.md) | Terrain, water, vegetation systems |
| [03-zoning-system.md](docs/game-design/03-zoning-system.md) | RCI zones, lot formation, development |
| [04-rci-demand.md](docs/game-design/04-rci-demand.md) | Demand model, caps, economic simulation |

### Technical Documents

| Document | Description |
|----------|-------------|
| [architecture.md](docs/technical/architecture.md) | System architecture, ECS, game loop |
| [isometric-rendering.md](docs/technical/isometric-rendering.md) | Coordinate systems, rendering pipeline |
| [tile-specifications.md](docs/visual/tile-specifications.md) | Sprite dimensions, color palettes |

## Architecture

The game uses a simplified Entity-Component-System (ECS) architecture:

- **Entities**: Unique IDs representing game objects
- **Components**: Data containers (Position, Zone, Building, etc.)
- **Systems**: Logic processors (TerrainSystem, ZoneSystem, etc.)

### Key Systems

1. **TerrainSystem**: Manages elevation, water, vegetation
2. **ZoneSystem**: Handles zone placement and lot formation
3. **DemandSystem**: Calculates RCI demand
4. **BuildingSystem**: Manages building development and abandonment
5. **TransportSystem**: Road networks, pathfinding, traffic
6. **UtilitySystem**: Power and water distribution
7. **SimulationSystem**: Time progression, city statistics

## AI-Assisted Development

This project is designed for iterative AI-assisted development:

1. **Modular Architecture**: Self-contained systems with clear interfaces
2. **Comprehensive Documentation**: Every feature documented before implementation
3. **Test-Driven**: Unit tests + Puppeteer visual tests
4. **Observable State**: All simulation state is inspectable
5. **Screenshot Verification**: Automated visual regression testing

### Development Workflow

```
1. Read documentation for target feature
2. Implement feature with TypeScript
3. Run automated tests (unit + visual)
4. Capture screenshots via Puppeteer
5. Review results, identify issues
6. Refine implementation
7. Update documentation if needed
```

## Contributing

This project is in early development. Contributions welcome after core systems are established.

### Roadmap

- [x] Documentation phase
- [ ] Core rendering engine
- [ ] Terrain generation
- [ ] Basic zoning
- [ ] Road placement
- [ ] RCI demand simulation
- [ ] Building growth
- [ ] Utilities
- [ ] Public services
- [ ] Finance system
- [ ] Save/Load

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- Maxis and Will Wright for the original SimCity series
- SimCity 4 community for game mechanics research
- PixiJS team for the excellent rendering library

---

*This project is a fan-made recreation for educational purposes and is not affiliated with or endorsed by Electronic Arts or Maxis.*
