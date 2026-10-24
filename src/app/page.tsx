import { About } from "@/components/About";
import { Chrome } from "@/components/Chrome";
import { Experience } from "@/components/Experience";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Projects } from "@/components/Projects";
import { Tools } from "@/components/Tools";

/**
 * Projects first, since they are the point of the page, then the small tools,
 * then the work history, then who I am and how to reach me.
 */
export default function Home() {
  return (
    <>
      <Chrome />
      <main>
        <Hero />
        <Projects />
        <Tools />
        <Experience />
        <About />
        <Footer />
      </main>
    </>
  );
}
