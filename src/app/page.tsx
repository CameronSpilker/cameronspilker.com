import { About } from "@/components/About";
import { Chrome } from "@/components/Chrome";
import { Experience } from "@/components/Experience";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Lab } from "@/components/Lab";
import { Projects } from "@/components/Projects";
import { Tools } from "@/components/Tools";

/**
 * Order matters: the projects are the argument and the resume is the evidence,
 * so the work someone can click into comes before the work they have to take
 * on trust. Tools sit with the lab for the same reason, since both are things
 * a reader can open rather than claims they have to believe.
 */
export default function Home() {
  return (
    <>
      <Chrome />
      <main>
        <Hero />
        <Projects />
        <Lab />
        <Tools />
        <Experience />
        <About />
        <Footer />
      </main>
    </>
  );
}
