import AudioPlayer from "./AudioPlayer"

function Biography() {
  return (
    <div className="mt-6 space-y-7 text-base text-zinc-600 dark:text-zinc-400">
       <div className="py-2">
        <AudioPlayer
          title="Listen to this, narrated by ElevenLabs."
          // src="https://s3.amazonaws.com/tugan/public/audio/mypage-biography.mp3"
          src="https://s3.amazonaws.com/tugan/public/audio/mypage-biography-10-25-2025.mp3"
        />
      </div> 
      <p>
        Some people know me as a technical geek, others as a passionate designer. I see no reason to choose between the two. To me, great design doesn't just make something look beautiful — it makes every interaction feel effortless and satisfying. That sense of aesthetic craftsmanship is what I think sets me apart from the classic Silicon Valley stereotype.
      </p>

      <p>
        When I was younger, I had no idea what I wanted to do — pretty common story. During college applications, under my dad's influence, I applied almost entirely to architecture programs — 18 out of 20, to be exact. After receiving multiple offers (with scholarships, even paying deposits), I realized architecture wasn't quite the right fit for the kind of life I wanted in the U.S., so I pivoted to business and finance.
      </p>

      <p>
        At first, I imagined myself becoming a consultant or investment banker. I joined case competitions, finance clubs, and studied late for interviews. But I've never been the kind of person who waits around for a curriculum to catch up with my curiosity. While classmates were reading textbooks, I was taking online programs from Wharton and Harvard Business School — over 1,000 hours of content and 13 specializations by my sophomore year. By then, my degree felt repetitive. So, I switched majors again — this time, to computer science.
      </p>

      <p>
        And that's where everything clicked. Unlike my earlier experiences with competitive programming back in China, this version of CS was fun — creative, logical, and full of possibility. With professors from Stanford and Berkeley shaping my thinking, I went all in, finishing the advanced graduate courses I wanted. And yes, I'll say it outright: I'm really good at programming, and I'm proud of that. During that time, I also joined Machine Learning at Berkeley's leadership team, where I learned from some of the sharpest minds in AI.
      </p>

      <p>
        Curiosity has always been my north star. My first college summer was in Europe for an entrepreneurship accelerator. The next was at an art school, diving deep into graphic, product, and 3D design — three months of pure creative flow. For my final summer, I spent a year at Apple working on Siri and AI. When I returned to campus, I even audited classes at the law school — everything from Contract Law to Constitutional Law. I guess I just really like connecting dots across disciplines.
      </p>

      <p>
        Outside of work, I travel — a lot. I've solo-traveled to all seven continents and 35 countries (and counting). My goal is one new country every year. I'm a recreational scuba diver, currently training for my pilot's license, and constantly trying to improve my skiing and snowboarding. Oh, and I'm also an amateur magician 🎩 — because life's more fun with a little mystery.
      </p>
    </div>
  )
}

export default Biography
