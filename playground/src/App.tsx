import React from 'react'

import { AnimatedCodeExample } from '@authzed/animated-code-example-component'
import { DemoScript, DemoStepKind, stepsForText, StepTarget } from '@authzed/animated-code-example-component';
import '@authzed/animated-code-example-component/dist/index.css'

const script: DemoScript = {
  initialEditorContent: `
@app.route('/')
def hello_world():
  return 'Hello World!'
`,
  initialReplContent: '',
  initialBrowserContent: 'Hello World!',
  editorLanguage: 'python',
  steps: [
    ...stepsForText(`from somelib import something\n`, StepTarget.EDITOR, 1, 1),
    ...stepsForText(' - Hi there!', StepTarget.EDITOR, 5, 23),
    ...stepsForText('./deploywebsite', StepTarget.REPL, 1, 1),
    { kind: DemoStepKind.SLEEP, duration: 200 },
    { kind: DemoStepKind.INSERT_TEXT, target: StepTarget.REPL, value: '\n> Website updated!' },
    { kind: DemoStepKind.SLEEP, duration: 500 },
    { kind: DemoStepKind.SET_BROWSER_CONTENT, target: StepTarget.BROWSER, value: 'Hello World! - Hi there!' },
  ]
}

const App = () => {
  return <AnimatedCodeExample script={script} theme="dark" highlightActiveElement={true} />;
}

export default App
