import type { Component, JSX } from "solid-js";

interface ModalProps {
  children: JSX.Element;
  onClose: () => void;
}

export const Modal: Component<ModalProps> = (props) => {
  return (
    <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/50" onClick={props.onClose}>
      <div class="rounded-xl border border-border-default bg-bg-secondary shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        {props.children}
      </div>
    </div>
  );
};
