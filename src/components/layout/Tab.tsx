import { createSignal, Show, type Component } from "solid-js";

interface TabProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  onRename?: (newName: string) => void;
}

export const Tab: Component<TabProps> = (props) => {
  const [editing, setEditing] = createSignal(false);
  const [editValue, setEditValue] = createSignal("");

  const startEdit = () => {
    if (!props.onRename) return;
    setEditValue(props.label);
    setEditing(true);
  };

  const commitEdit = () => {
    const val = editValue().trim();
    setEditing(false);
    if (val && val !== props.label) {
      props.onRename?.(val);
    }
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  return (
    <Show
      when={editing()}
      fallback={
        <button
          onClick={props.onClick}
          onDblClick={(e) => {
            e.stopPropagation();
            startEdit();
          }}
          class={`px-3 py-1.5 text-sm rounded-t transition-colors truncate max-w-[160px] ${
            props.active
              ? "bg-bg-primary text-text-primary border-t border-x border-border-default"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
          }`}
          title={props.label}
        >
          {props.label}
        </button>
      }
    >
      <input
        ref={(el) => setTimeout(() => el.focus(), 0)}
        type="text"
        value={editValue()}
        onInput={(e) => setEditValue(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitEdit();
          if (e.key === "Escape") cancelEdit();
        }}
        onBlur={commitEdit}
        class="px-2 py-1 text-sm rounded border border-accent bg-bg-tertiary text-text-primary focus:outline-none w-[140px]"
      />
    </Show>
  );
};
