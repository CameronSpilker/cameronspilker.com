import { About } from "@/components/About";
import { Chrome } from "@/components/Chrome";
import { Experience } from "@/components/Experience";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Lab } from "@/components/Lab";
import { Projects } from "@/components/Projects";

/**
 * Order matters: the projects are the argument and the resume is the evidence,
 * so the work someone can click into comes before the work they have to take
 * on trust.
 */
export default function Home() {
  return (
    <>
      <Chrome />
      <main>
        <Hero />
        <Projects />
        <Lab />
        <Experience />
        <About />
        <Footer />
      </main>
    </>
  );
}
