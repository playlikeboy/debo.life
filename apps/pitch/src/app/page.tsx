import {
  Ask,
  BusinessModel,
  CompetitionSummary,
  DeckHero,
  Demo,
  GoToMarketSummary,
  Insight,
  MarketSummary,
  Moat,
  Problem,
  Product,
  Roadmap,
  Solution,
  Team,
  Traction,
  WhyNow,
} from "../components/deck";
import { Shell } from "../components/shell";

export default function Deck() {
  return (
    <Shell>
      <DeckHero />
      <Problem />
      <Insight />
      <Solution />
      <Product />
      <Demo />
      <WhyNow />
      <MarketSummary />
      <BusinessModel />
      <GoToMarketSummary />
      <CompetitionSummary />
      <Moat />
      <Traction />
      <Roadmap />
      <Team />
      <Ask />
    </Shell>
  );
}
