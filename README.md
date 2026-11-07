# Stewards' Room

**Live site: https://fexothefco.github.io/stewards-room/**

An unofficial fan project that gathers the FIA Formula 1 stewards' decisions in one place, so they are easy to browse, filter and compare. It is made for journalists and fans who want to understand how the sport is being officiated, never to attack anyone.

*Un proyecto de fans, no oficial, que reúne en un solo lugar las decisiones de los comisarios de la FIA en la Fórmula 1, para poder explorarlas, filtrarlas y compararlas. Está pensado para periodistas y aficionados que quieren entender cómo se arbitra el deporte, nunca para atacar a nadie.*

## What you can do

- **Overview** – drivers ranked by number of stewards' cases, with the outcome of each (penalty, reprimand, no further action).
- **Drivers** – every driver, with a page of their own: cases by Grand Prix, licence points and a timeline.
- **Cases** – every decision, filterable by Grand Prix, session, outcome, driver, steward, points and type of infringement. Each row links to the original FIA document.
- **Stewards** – who decided what.

The site is bilingual (English / Español). The text of each fact and decision is shown as the FIA published it, in English.

## Where the data comes from

- The decision documents published by the FIA for the 2026 season (fia.com). Every row links back to its PDF.
- [OpenF1](https://openf1.org) for driver numbers and team colours.
- Driver photos are loaded straight from Formula 1's own servers; nothing of theirs is stored in this repository.

The site has no server and no tracking: your browser downloads one data file and every filter runs on your own device.

## About this repository

This repository only holds the **published site** (`site/`) and the workflow that deploys it to GitHub Pages. It is generated, so please do not edit it by hand: the data collection and the source it is built from live in a private project. Issues and suggestions are welcome.

## Notices

- Not affiliated with, endorsed by or connected to the FIA, Formula 1 or any team. Names, photos and marks belong to their owners.
- Decisions are public record. Harassment of any driver, steward, official or anyone in the sport is not tolerated; if the site is used for that, it will be shut down.
- Fonts: Oswald and Inter are under the SIL Open Font License (licences in `site/fonts/`). The driver-name typeface (DaggerSquare, 1001Fonts "Free For Commercial Use" licence) is embedded in the deployed site but is deliberately not part of this repository.
