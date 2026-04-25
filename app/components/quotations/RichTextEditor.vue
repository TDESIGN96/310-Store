<script setup lang="ts">
import { computed, watch } from 'vue'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { Bold, Italic, List, ListOrdered, Undo2, Redo2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [string]
}>()

const editor = useEditor({
  content: props.modelValue || '',
  extensions: [
    StarterKit,
  ],
  editorProps: {
    attributes: {
      class: 'min-h-[130px] w-full rounded-b-md border border-t-0 border-input bg-background px-3 py-2 text-sm outline-none',
    },
  },
  onUpdate({ editor: ed }) {
    emit('update:modelValue', ed.getHTML())
  },
})

watch(
  () => props.modelValue,
  (value) => {
    if (!editor.value) return
    if (value === editor.value.getHTML()) return
    editor.value.commands.setContent(value || '', { emitUpdate: false })
  },
)

const canUndo = computed(() => editor.value?.can().undo() ?? false)
const canRedo = computed(() => editor.value?.can().redo() ?? false)
</script>

<template>
  <div class="w-full">
    <div class="flex flex-wrap items-center gap-1 rounded-t-md border border-input bg-muted/20 p-1.5">
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
    <EditorContent :editor="editor" />
  </div>
</template>
