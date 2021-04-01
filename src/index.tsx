import Editor, { useMonaco } from "@monaco-editor/react";
import clsx from 'clsx';
import monaco from 'monaco-editor-core';
import React, { useEffect, useRef, useState } from "react";
import { useInView } from 'react-intersection-observer';
import Styles from './animated-code-example.module.css';

/**
 * DemoStepKind holds the kinds of steps in the demo script.
 */
export enum DemoStepKind {
  /**
   * SLEEP indicates the animation should sleep for the `duration` number of ms.
   */
  SLEEP = -1,

  /**
   * INSERT_TEXT inserts the text found in `value`. For insertion into the editor, must
   * not contain a newline (use INSERT_NEWLINE).
   */
  INSERT_TEXT = 1,

  /**
   * INSERT_NEWLINE inserts a newline.
   */
  INSERT_NEWLINE = 2,

  /**
   * INSERT_PASTED_TEXT inserts the given text as if it were pasted in by the user.
   */
  INSERT_PASTED_TEXT = 3,

  /**
   * SET_BROWSER_CONTENT sets the contents of the browser pane.
   */
  SET_BROWSER_CONTENT = 4,
}

/**
 * StepTarget is the target of the step in the script.
 */
export enum StepTarget {
  EDITOR = 0,
  REPL = 1,
  BROWSER = 2
}

export type DeltaStepKind = Exclude<DemoStepKind, DemoStepKind.SLEEP>

export type DeltaStep = {
  /**
   * kind is the kind of action in the demo script.
   */
  kind: DeltaStepKind

  /**
   * target is the target of the step.
   */
  target: StepTarget

  /**
   * If target = EDITOR, the starting line number at which to perform the insertion. If not given,
   * the last insertion location is used.
   */
  startLineNumber?: number

  /**
   * If target = EDITOR, the starting column index at which to perform the insertion. If not given,
   * the last insertion location is used.
   */
  startColumnIndex?: number

  /**
   * value is the value of the action. For editor/repl, it is the text to insert. For the browser,
   * it is the content to display.
   */
  value: string
};

export type SleepStep = {
  kind: DemoStepKind.SLEEP,
  duration: number
};

/**
 * DemoScriptStep defines a single step in the DemoScript.
 */
export type DemoScriptStep = DeltaStep | SleepStep;

/**
 * DemoScript defines a script for how to animate the code example.
 */
export interface DemoScript {
  /**
   * steps are the individual steps or actions to take in the animation script.
   */
  steps: DemoScriptStep[]

  /**
   * initialBrowserContent is the initial content to display in the browser pane.
   */
  initialBrowserContent: string

  /**
   * initialReplContent is the initial content to display in the REPL pane.
   */
  initialReplContent: string

  /**
   * initialEditorContent is the initial content to display in the editor pane.
   */
  initialEditorContent: string

  /**
   * editorLanguage is the Monaco language to use for the editor.
   */
  editorLanguage: string
}

/**
 * stepsForText converts a text string into a series of DemoScriptStep's, with appropriate
 * kinds for whitespace, newlines and pastes. Note that clusters of whitespace will be converted
 * to a single insertion, to match auto-indentation.
 * 
 * @param text The text to convert.
 * @param target The targert for the elements (must be EDITOR or REPL)
 * @param startLineNumber The optional starting line number (1-indexed)
 * @param startColumnIndex The optional starting column index (1-indexed).
 * @param pasteDelimiters If specified, the delimiters to be used for kind=INSERT_PASTE text. If
 * not specified, the unicode characters `«` and `»` are used.
 * @returns The created steps.
 */
export function stepsForText(text: string, target: StepTarget, startLineNumber?: number, startColumnIndex?: number, pasteDelimiters?: string[]): DemoScriptStep[] {
  const steps: DeltaStep[] = [];
  const [leftPasteDel, rightPasteDel] = pasteDelimiters ?? ['«', '»']

  let currentIndex = 0;

  const consumeChar = () => {
    if (currentIndex >= text.length) {
      return undefined;
    }

    currentIndex += 1;
    return text[currentIndex - 1];
  };

  const peek = () => {
    if (currentIndex >= text.length) {
      return undefined;
    }

    return text[currentIndex];
  };

  const addStep = (kind: DeltaStepKind, value: string) => {
    steps.push({
      target: target,
      kind: kind,
      value: value,
    })
  };

  const consumeWhitespace = () => {
    let consumed = '';
    while (peek() === ' ') {
      consumed += consumeChar();
    }
    return consumed;
  };

  const consumePaste = () => {
    let consumed = '';
    while (true) {
      const peeked = peek();
      if (peeked === undefined) {
        throw Error("Unterminated paste");
      }

      if (peeked === '\n') {
        throw Error('Newline not allowed in paste')
      }

      if (peeked === rightPasteDel) {
        consumeChar();
        return consumed;
      }

      consumed += consumeChar();
    }
  };

  while (true) {
    const char = consumeChar();
    if (char === undefined) {
      break;
    }

    if (char === '\n') {
      addStep(DemoStepKind.INSERT_NEWLINE, '\n');
      continue;
    }

    if (char === ' ') {
      const remainder = consumeWhitespace();
      addStep(DemoStepKind.INSERT_TEXT, ' ' + remainder);
      continue;
    }

    if (char === leftPasteDel) {
      addStep(DemoStepKind.INSERT_PASTED_TEXT, consumePaste());
      continue;
    }

    addStep(DemoStepKind.INSERT_TEXT, char);
  }

  if (steps.length > 0) {
    steps[0].startLineNumber = startLineNumber
    steps[0].startColumnIndex = startColumnIndex
  }

  return steps;
}

interface Delays {
  startDelay?: number | undefined
  endDelay?: number | undefined
}

const PASTE_DELAYS: Delays = {
  startDelay: 300,
  endDelay: 100,
}

const DELAY_CHARACTERS: Record<string, Delays> = {
  ' ': {
    endDelay: 110
  },
  '\n': {
    endDelay: 60,
  },
  '(': {
    startDelay: 80,
    endDelay: 60,
  },
  ')': {
    startDelay: 80,
    endDelay: 60,
  },
}

const lookupDelays = (step: DeltaStep): Delays => {
  switch (step.kind) {
    case DemoStepKind.INSERT_NEWLINE:
      return DELAY_CHARACTERS['\n']

    case DemoStepKind.INSERT_PASTED_TEXT:
      return PASTE_DELAYS;

    default:
      if (step.value.length === 1) {
        if (step.value in DELAY_CHARACTERS) {
          return DELAY_CHARACTERS[step.value];
        } else {
          // Default character delay.
          return {
            endDelay: 60
          }
        }
      }

      return {};
  }
};

export interface AnimatedCodeExampleProps {
  /**
   * script is the script for the animation.
   */
  script: DemoScript

  /**
   * browserDisplayedUrl is the URL to display in the browser pane. If unspecified, defaults
   * to `https://example.com`
   */
  browserDisplayedUrl?: string

  /**
   * editorWidth is the width of the code editor displayed. Defaults to 600.
   */
  editorWidth?: number

  /**
   * editorHeight is the height of the code editor displayed. Defaults to 300.
   */
  editorHeight?: number

  /**
   * rootClassName is the custom root CSS class name for the component.
   */
  rootClassName?: string
}

const sleep = (ms: number) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * AnimatedCodeExample displays an animated code example as a component.
 */
export function AnimatedCodeExample(props: AnimatedCodeExampleProps) {
  const monaco = useMonaco();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [isEditorReady, setEditorReady] = useState(false);

  const handleEditorMounted = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    setEditorReady(true);
  }

  const [browserContent, setBrowserContent] = useState(props.script.initialBrowserContent);
  const [replContent, setReplContent] = useState(props.script.initialReplContent);
  const [target, setTarget] = useState<StepTarget | undefined>(undefined);

  const { inView, ref } = useInView({
    threshold: 1,
    triggerOnce: true,
  });

  useEffect(() => {
    const runScript = () => {
      (async () => {
        await sleep(300);

        const script = props.script;
        var id = { major: 1, minor: 1 };
        var decorations: any[] = [];

        let lineNumber = 1;
        let columnIndex = 1;

        let newRepl = props.script.initialReplContent;
        let currentTarget: StepTarget | undefined = undefined;

        const changeTarget = async (step: DeltaStep) => {
          if (currentTarget !== step.target) {
            currentTarget = step.target;
            setTarget(step.target);
            await sleep(100);
          }
        };

        for (const step of script.steps) {
          if (step.kind === DemoStepKind.SLEEP) {
            await sleep(step.duration);
          } else if (step.kind === DemoStepKind.SET_BROWSER_CONTENT) {
            // If the target is different, switch to it first before running.
            await changeTarget(step);
            setBrowserContent('')
            await sleep(500);
            setBrowserContent(step.value)
            await sleep(200);
            continue;
          } else {
            // If the target is different, switch to it first before running.
            await changeTarget(step);

            const delays = lookupDelays(step);
            if (delays.startDelay !== undefined) {
              await sleep(delays.startDelay);
            }

            if (step.target === StepTarget.EDITOR) {
              lineNumber = step.startLineNumber ?? lineNumber
              columnIndex = step.startColumnIndex ?? columnIndex

              var range = new monaco!.Range(lineNumber, columnIndex, lineNumber, columnIndex);
              var op = { identifier: id, range: range, text: step.value, forceMoveMarkers: true };
              editorRef.current!.executeEdits("animated-code-example", [op]);

              if (step.value.trim().length) {
                editorRef.current!.deltaDecorations([], [{
                  range: new monaco.Range(lineNumber, columnIndex, lineNumber, columnIndex + step.value.length),
                  options: { inlineClassName: 'addition' }
                }])
              }

              const newDecorations = [
                {
                  range: new monaco.Range(lineNumber, columnIndex, lineNumber, columnIndex + step.value.length),
                  options: { inlineClassName: 'fake-cursor', stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges }
                },
              ];

              decorations = editorRef.current!.deltaDecorations(decorations, newDecorations)

              if (step.kind === DemoStepKind.INSERT_NEWLINE) {
                lineNumber += 1;
                columnIndex = 1;
              } else {
                columnIndex += step.value.length;
              }
            } else {
              newRepl = newRepl + step.value;
              setReplContent(newRepl);
            }

            if (delays.endDelay !== undefined) {
              await sleep(delays.endDelay);
            }
          }
        }
      })();
    };

    if (monaco && isEditorReady && inView) {
      runScript();
    }
  }, [monaco, isEditorReady, inView, props.script]);

  return <div ref={ref}>
    <div className={clsx(Styles['animated-preview'], props.rootClassName)}>
      <div className={clsx(Styles["editor-container"], Styles["target"], { [Styles["active"]]: target === StepTarget.EDITOR })}>
        <div className={Styles["editor-overlay"]}></div>
        <Editor
          value={props.script.initialEditorContent}
          width={props.editorWidth ?? 600}
          height={props.editorHeight ?? 300}
          language={props.script.editorLanguage}
          onMount={handleEditorMounted}
          options={{
            scrollbar: { handleMouseWheel: false },
            minimap: {
              enabled: false
            },
            highlightActiveIndentGuide: false,
            cursorStyle: 'block-outline',
            overviewRulerBorder: false,
            renderLineHighlight: "none"
          }}
        />
      </div>

      <pre className={clsx(Styles["repl"], Styles["target"], { [Styles["active"]]: target === StepTarget.REPL })}>$ {replContent}</pre>

      <div className={clsx(Styles["browser"], Styles["target"], { [Styles["active"]]: target === StepTarget.BROWSER })}>
        <div className={Styles["browser-navigation-bar"]}>
          <i></i><i></i><i></i>
          <input value={props.browserDisplayedUrl ?? 'https://example.com'} disabled />
        </div>

        <div className={Styles["browser-container"]} style={{ padding: "6px" }}>
          {browserContent !== '' && browserContent}
          {browserContent === '' && <div className={Styles["loader"]} />}
        </div>
      </div>
    </div>
  </div>;
}