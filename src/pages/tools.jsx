import Head from 'next/head'

import { Card } from '@/components/Card'
import { Section } from '@/components/Section'
import { SimpleLayout } from '@/components/SimpleLayout'

function ToolsSection({ children, ...props }) {
  return (
    <Section {...props}>
      <ul role="list" className="space-y-5">
        {children}
      </ul>
    </Section>
  )
}

function Tool({ title, href, children }) {
  return (
    <Card as="li">
      <Card.Title as="h3" href={href}>
        {title}
      </Card.Title>
      <Card.Description>{children}</Card.Description>
    </Card>
  )
}

export default function Tools() {
  return (
    <>
      <Head>
        <title>Tools - Gan Tu</title>
        <meta
          name="description"
          content="Software I use, gadgets I love, and other things I recommend."
        />
      </Head>
      <SimpleLayout
        title="Software I use, gadgets I love, and other things I recommend."
        intro="I get asked a lot about the things I use to build software, stay productive, or buy to fool myself into thinking I’m being productive when I’m really just procrastinating. Here’s a list of some of my favorite stuff."
      >
        <div className="space-y-20">
          <ToolsSection title="Workstation">
            <Tool title="16” MacBook Pro, M1 Max">
              I am an Apple fan and I simply love Mac. Sorry, no Windows.
            </Tool>
            <Tool title="Logitech MX Master 3 and MX Keys for Mac">
              Logitech MX Master Series mouse and keyboard are simply the best,
              and they are my favorite go-to work companions. I credit them for
              super charging my productivitiy, and their ability to work with
              multiple sets of machines are pure incredible.
            </Tool>
          </ToolsSection>
          <ToolsSection title="Productivity">
            <Tool title="CleanShot X">
              CleanShot X is the best screenshot and screen recording app for
              Mac that I've used. It has various features like OCR, built-in
              annotation tool, Cloud uploading, scrolling capture, background
              tool, and a lot more.
            </Tool>
            <Tool title="Alfred 5">
              I fell in love with Alfred ever since it's introduced to me by
              friends. It’s not the newest kid on the block but it’s still the
              fastest. The Sublime Text of the application launcher world.
            </Tool>
            <Tool title="Things">
              Everyone has their own task management app, and Things is my
              favourite. I like its minimalist design, cute interaction
              animations, and amazing cross platform support.
            </Tool>
            <Tool title="Day One">
              I journal daily, and this app has the records of all my random
              thoughts and memories throughout the years.
            </Tool>
            <Tool title="Finance by Matthias Hochgatterer">
              A doubule-entry finance journaling app by developer Matthias
              Hochgatterer. You cannot even find it easily on Apple Store, but I
              think it's better than all other finance apps out there. It's
              simple and straight-to-the-point. I have the habbit of logging and
              categorizing every single financial transaction I've made for
              decades now, and this is the app I've stick with all this time.
            </Tool>
          </ToolsSection>
          <ToolsSection title="Developer Tools">
            <Tool title="Sublime Text">
              I don’t care if it’s missing all of the fancy IDE features
              everyone else relies on, Sublime Text is still the best text
              editor ever made.
            </Tool>
            <Tool title="Visual Studio Code">
              This one needs no introduction. The king of IDE for writing code.
            </Tool>
            <Tool title="Cursor">
              Cursor AI is really nice as an alternative to GitHub co-pilot, so
              I use it when I have free quota avaliable since I don't want to pay.
            </Tool>
            <Tool title="iTerm2">
              I’m honestly not even sure what features I get with this that
              aren’t just part of the macOS Terminal but it’s what I use. Maybe
              I just like the better color theme in iTerm2.
            </Tool>
          </ToolsSection>
          <ToolsSection title="Framework">
            <Tool title="React">
              Amongst all the web framework I learned, React is my favorite.
              After the introduction of React hooks, I fell deeply in love with
              it. I prefer React over all other frameworks I learned and used
              over the years, including but not limited to Django, Flask, Ruby
              on Rails, AngularJS. My favoirte React framework is NextJS.
            </Tool>
            <Tool title="Tailwind CSS">
              Let's say that I hated CSS until I learned Tailwind CSS. It's
              simple, beautiful, flexible, and intuitive. Sure it makes the
              website HTML full of CSS-like classes, but they make UI so much
              easier to customize and debug.
            </Tool>
            <Tool title="Headless UI">
              Headless UI is another gem brought to life by Tailwind Labs. Its
              completely unstyled, fully accessible UI components integrate
              beautifully with Tailwind CSS.
            </Tool>
            <Tool title="Framer Motion">
              Framer Motion really makes animation simple yet powerful. It
              integrates beautifully with React. What more can I say. If you
              never used it, go check it out.
            </Tool>
            <Tool title="SwiftUI">
              SwiftUI makes iOS development incredibly easy, and really
              showcases why iOS is a much better phone operating system over
              Android as a result of its opinionated developer API inspired by
              Apple's unique and successful user interface patterns.
            </Tool>
          </ToolsSection>
        </div>
      </SimpleLayout>
    </>
  )
}
