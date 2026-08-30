import { About } from "@/components/About";
import { DataStack } from "@/components/DataStack";
import { Experience } from "@/components/Experience";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Projects } from "@/components/Projects";

export default function Home() {
  return (
    <main>
      <Hero />
      <Experience />
      <Projects />
      <DataStack />
      <About />
      <Footer />
    </main>
  );
}
