<script setup lang="ts">
import { computed, watch } from 'vue'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { Bold, Italic, List, ListOrdered, Undo2, Redo2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const props = defineProps<{
  modelValue: string
  placeholder?: string
  invalid?: boolean
  errorMessage?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [string]
}>()

function normalizeEditorHtml(html: string, isEmpty: boolean): string {
  if (isEmpty) return ''
  return html
}

const editor = useEditor({
  content: props.modelValue || '',
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: () => props.placeholder || '',
    }),
  ],
  editorProps: {
    attributes: {
      class: 'rich-text-content min-h-[130px] w-full rounded-b-md border border-t-0 border-input bg-background px-3 py-2 text-sm outline-none',
    },
  },
  onUpdate({ editor: ed }) {
    const html = normalizeEditorHtml(ed.getHTML(), ed.isEmpty)
    emit('update:modelValue', html)
  },
})

watch(
  () => props.modelValue,
  (value) => {
    if (!editor.value) return
    const next = value || ''
    const current = normalizeEditorHtml(editor.value.getHTML(), editor.value.isEmpty)
    if (next === current) return
    editor.value.commands.setContent(next, { emitUpdate: false })
  },
)

watch(
  () => props.placeholder,
  () => {
    editor.value?.view.dispatch(editor.value.view.state.tr)
  },
)

const canUndo = computed(() => editor.value?.can().undo() ?? false)
const canRedo = computed(() => editor.value?.can().redo() ?? false)
</script>

<template>
  <div class="w-full">
    <div
      :class="cn(
        'flex flex-wrap items-center gap-1 rounded-t-md border border-input bg-muted/20 p-1.5',
        props.invalid && 'border-destructive',
      )"
    >
      <Button
        type="button"
        size="icon"
        variant="ghost"
        class="size-8"
        :disabled="!editor"
        @click="editor?.chain().focus().toggleBold().run()"
      >
        <Bold class="size-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        class="size-8"
        :disabled="!editor"
        @click="editor?.chain().focus().toggleItalic().run()"
      >
        <Italic class="size-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        class="size-8"
        :disabled="!editor"
        @click="editor?.chain().focus().toggleBulletList().run()"
      >
        <List class="size-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        class="size-8"
        :disabled="!editor"
        @click="editor?.chain().focus().toggleOrderedList().run()"
      >
        <ListOrdered class="size-4" />
      </Button>
      <div class="mx-1 h-6 w-px bg-border" />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        class="size-8"
        :disabled="!editor || !canUndo"
        @click="editor?.chain().focus().undo().run()"
      >
        <Undo2 class="size-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        class="size-8"
        :disabled="!editor || !canRedo"
        @click="editor?.chain().focus().redo().run()"
      >
        <Redo2 class="size-4" />
      </Button>
    </div>
    <EditorContent
      :editor="editor"
      role="textbox"
      :aria-invalid="props.invalid ? 'true' : undefined"
      :class="cn(
        '[&_.is-editor-empty]:before:pointer-events-none [&_.is-editor-empty]:before:float-start [&_.is-editor-empty]:before:h-0 [&_.is-editor-empty]:before:text-muted-foreground [&_.is-editor-empty]:before:content-[attr(data-placeholder)]',
        props.invalid && '[&_.ProseMirror]:border-destructive',
      )"
    />
    <p v-if="props.errorMessage" class="mt-1 text-xs text-destructive">{{ props.errorMessage }}</p>
  </div>
</template>
