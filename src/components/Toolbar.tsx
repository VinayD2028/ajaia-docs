"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";

function Btn(props: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      aria-pressed={props.active}
      title={props.label}
      // mousedown preventDefault keeps editor focus/selection when clicking the toolbar
      onMouseDown={(e) => e.preventDefault()}
      onClick={props.onClick}
      className={`min-h-9 min-w-9 rounded px-2 py-1 text-sm ${
        props.active ? "bg-blue-100 text-blue-800" : "hover:bg-gray-100"
      }`}
    >
      {props.children}
    </button>
  );
}

export default function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      p: e.isActive("paragraph"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
    }),
  });
  const run = () => editor.chain().focus();

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-3 py-2">
      <Btn label="Bold" active={s.bold} onClick={() => run().toggleBold().run()}><b>B</b></Btn>
      <Btn label="Italic" active={s.italic} onClick={() => run().toggleItalic().run()}><i>I</i></Btn>
      <Btn label="Underline" active={s.underline} onClick={() => run().toggleUnderline().run()}><u>U</u></Btn>
      <span className="mx-1 h-5 w-px bg-gray-300" />
      <Btn label="Heading 1" active={s.h1} onClick={() => run().toggleHeading({ level: 1 }).run()}>H1</Btn>
      <Btn label="Heading 2" active={s.h2} onClick={() => run().toggleHeading({ level: 2 }).run()}>H2</Btn>
      <Btn label="Heading 3" active={s.h3} onClick={() => run().toggleHeading({ level: 3 }).run()}>H3</Btn>
      <Btn label="Normal text" active={s.p} onClick={() => run().setParagraph().run()}>¶</Btn>
      <span className="mx-1 h-5 w-px bg-gray-300" />
      <Btn label="Bulleted list" active={s.bullet} onClick={() => run().toggleBulletList().run()}>• List</Btn>
      <Btn label="Numbered list" active={s.ordered} onClick={() => run().toggleOrderedList().run()}>1. List</Btn>
    </div>
  );
}
