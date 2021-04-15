# @authzed/animated-code-example-component &middot; [![monthly downloads](https://img.shields.io/npm/dm/@authzed/animated-code-example-component)](https://www.npmjs.com/package/@authzed/animated-code-example-component) [![gitHub license](https://img.shields.io/badge/license-Apache-blue.svg)](https://github.com/authzed/animated-code-example-component/blob/master/LICENSE) [![npm version](https://img.shields.io/npm/v/@authzed/animated-code-example-component.svg?style=flat)](https://www.npmjs.com/package/@authzed/animated-code-example-component) [![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/authzed/animated-code-example-component/pulls)

Component for displaying an animated code example, along with an animated REPL-like environment and fake web browser. Useful for showing small "live" examples on landing and marketing pages. Only begins the animation once the component is visible on the page.

## Documentation

* [Installation](#installation)
* [Introduction](#introduction)
* [Usage](#usage)
  * [Simple example](#simple-example)
* [Playground](#playground)

### Installation

```bash
npm install @authzed/animated-code-example-component
```

or

```bash
yarn add @authzed/animated-code-example-component
```

**NOTE:** Requires React.

### Introduction

The Animated Code Example Component displays a fake code editor, REPL-like environment and web browser, all of which are scriptable by the caller to produce an animated virtual development enivornment for display on a landing or marketing page.

#### Simple example

A simple example that shows a (fake) website, "edits" it, then updates the website.

```ts
import React from "react";
import ReactDOM from "react-dom";

import {DemoScript, DemoStepKind, stepsForText, StepTarget} from '@authzed/animated-code-example-component';

// Include the CSS for the component.
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

function App() {
  return (
    <AnimatedCodeExample script={script} />;
  );
}

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);
```

### Playground

To edit and test demo scripts, the playground can be run via yarn:

```sh
cd playground
yarn install # If this is the first time running
yarn start
```
