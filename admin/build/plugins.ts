import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import svgLoader from "vite-svg-loader";
import Icons from "unplugin-icons/vite";
import tailwindcss from "@tailwindcss/vite";
import type { PluginOption } from "vite";

export function getPluginsList(): PluginOption[] {
  return [tailwindcss(), vue(), vueJsx(), svgLoader(), Icons({ compiler: "vue3", scale: 1 })];
}
