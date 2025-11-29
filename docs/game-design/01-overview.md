# SimCity Clone - Game Design Overview

## Project Vision

This project aims to faithfully reproduce the city-building mechanics of SimCity 4 Deluxe's Mayor Mode. The game will be a web-based, isometric city builder that simulates urban development, infrastructure management, and civic planning.

## Reference Game: SimCity 4 Deluxe (2003)

SimCity 4 Deluxe includes the base game and the Rush Hour expansion. This documentation focuses on **Mayor Mode**, where players:
- Zone land for development (Residential, Commercial, Industrial)
- Build transportation infrastructure
- Provide utilities (power, water)
- Fund public services (police, fire, education, healthcare)
- Manage city finances through taxes and budgets
- Respond to advisors and citizen needs

## Core Gameplay Loop

```
┌─────────────────────────────────────────────────────────────┐
│                    MAYOR MODE LOOP                          │
├─────────────────────────────────────────────────────────────┤
│  1. OBSERVE     │ View city state, data overlays, advisors  │
│  2. PLAN        │ Decide what to build/zone/fund            │
│  3. BUILD       │ Place zones, roads, buildings             │
│  4. SIMULATE    │ Time passes, city evolves                 │
│  5. RESPOND     │ React to problems, adjust budgets         │
│  └──────────────┴─────────────────────────────────────────→ │
└─────────────────────────────────────────────────────────────┘
```

## Key Systems Overview

### 1. Terrain & Environment
The foundation of any city. Players start with a wilderness containing:
- Varied elevation (hills, valleys, cliffs)
- Water bodies (rivers, lakes, coastlines)
- Natural vegetation (trees, forests)
- Wildlife (cosmetic)

### 2. Zoning System
The primary city-building mechanic. Three zone types with density variants:

| Zone Type | Densities | Purpose |
|-----------|-----------|---------|
| **Residential (R)** | Low, Medium, High | Housing for Sims |
| **Commercial (C)** | Low, Medium, High | Shops, offices, services |
| **Industrial (I)** | Agriculture, Dirty, Manufacturing, High-Tech | Jobs, production |

### 3. RCI Demand Model
A dynamic supply/demand system determining what the city needs:
- **Demand bars** show positive (need more) or negative (oversupply) demand
- Demand is driven by population, jobs, commute times, desirability
- **Demand caps** limit growth until unlocked by meeting conditions

### 4. Building Development
Zones develop organically based on:
- Demand levels
- Land value
- Desirability factors
- Infrastructure availability
- Building stages (small → medium → large)

### 5. Transportation Network
Movement system for Sims and goods:

| Type | Variants |
|------|----------|
| **Roads** | Street, Road, Avenue, One-way, Highway |
| **Rail** | Passenger Rail, Freight Rail, Monorail, Elevated Rail |
| **Mass Transit** | Bus Stops/Depots, Subway Stations, Ferry Terminals |
| **Other** | Airports, Seaports, Pedestrian Paths |

### 6. Utilities
Essential services for building development:
- **Power**: Plants (coal, oil, gas, nuclear, wind, solar), transmission lines
- **Water**: Pumping stations, water towers, treatment plants, pipes
- **Garbage**: Landfills, incinerators, recycling centers

### 7. Public Services
Government-provided services with coverage areas:
- **Safety**: Police stations, fire stations, jails
- **Health**: Clinics, hospitals
- **Education**: Elementary schools, high schools, colleges, libraries, museums

### 8. Finance System
Economic management:
- **Taxes**: Adjustable by zone type and wealth level (§, §§, §§§)
- **Budgets**: Slider-based funding for each department
- **Ordinances**: City-wide policies with costs/benefits
- **Loans**: Borrow money with interest

### 9. Simulation Behaviors
Agent-based and cellular automata simulations:
- **Traffic**: Pathfinding, congestion, commute calculation
- **Crime**: Based on poverty, police coverage, land value
- **Pollution**: Air, water, garbage; sources and spread
- **Land Value**: Calculated from desirability factors
- **Mayor Rating**: Citizen satisfaction metric

### 10. Time & Speed
Simulation progresses through selectable speeds:
- **Pause**: No simulation, planning mode
- **Turtle**: Slow speed
- **Rhino**: Medium speed  
- **Cheetah**: Fast speed

## Technical Targets

| Aspect | Target |
|--------|--------|
| **Platform** | Web browser (Chrome, Firefox, Safari) |
| **Rendering** | 2D Isometric via WebGL (PixiJS) |
| **Tile Size** | 64×32 pixels (2:1 isometric ratio) |
| **Map Size** | Small (64×64), Medium (128×128), Large (256×256) |
| **Frame Rate** | 60 FPS minimum |
| **Simulation Tick** | Configurable (default: 100ms) |

## Development Principles

### AI-Assisted Development Guidelines
This project is designed for iterative AI development:

1. **Modular Architecture**: Each system is self-contained with clear interfaces
2. **Test-Driven**: Puppeteer visual tests, unit tests for simulation logic
3. **Observable State**: All simulation state is inspectable and serializable
4. **Hot-Reloadable**: Changes apply without full restart
5. **Screenshot Verification**: Automated visual regression testing

### Iteration Workflow
```
┌─────────────────────────────────────────────────────────────┐
│  1. Read documentation for target feature                   │
│  2. Implement feature with TypeScript                       │
│  3. Run automated tests (unit + visual)                     │
│  4. Capture screenshots via Puppeteer                       │
│  5. Review results, identify issues                         │
│  6. Refine implementation                                   │
│  7. Update documentation if behavior changes                │
└─────────────────────────────────────────────────────────────┘
```

## Document Map

| Document | Contents |
|----------|----------|
| `02-terrain-environment.md` | Wilderness, elevation, water, vegetation |
| `03-zoning-system.md` | Zone types, densities, placement rules |
| `04-rci-demand.md` | Demand model, caps, growth triggers |
| `05-building-growth.md` | Development stages, lot sizes, wealth |
| `06-transportation.md` | Roads, rail, mass transit, pathfinding |
| `07-utilities.md` | Power, water, garbage systems |
| `08-public-services.md` | Police, fire, health, education |
| `09-city-services.md` | Parks, landmarks, rewards |
| `10-finance-system.md` | Taxes, budgets, ordinances, loans |
| `11-advisors-data.md` | Advisor messages, data overlays |
| `12-simulation-behaviors.md` | Traffic, crime, pollution, land value |

## Glossary

| Term | Definition |
|------|------------|
| **Sim** | A simulated citizen/resident |
| **RCI** | Residential, Commercial, Industrial (zone types) |
| **Plop** | Manually place a building (vs. zone growth) |
| **Demand Cap** | Maximum demand level until condition met |
| **Desirability** | Attractiveness of a tile for development |
| **Land Value** | Economic worth of a tile (affects wealth levels) |
| **Coverage** | Area of effect for services (police, fire, etc.) |
| **Commute** | Travel path from residence to workplace |
| **Mayor Rating** | Overall citizen satisfaction (0-100%) |
