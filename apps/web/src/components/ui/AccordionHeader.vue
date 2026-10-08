<template>
  <summary
    class="cursor-pointer list-none px-4 py-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black [&::-webkit-details-marker]:hidden"
  >
    <span class="inline-flex w-full items-center justify-between gap-3"
      ><span><slot /></span
      ><span aria-hidden="true" class="text-gray-600"
        ><span class="group-open:hidden">+</span
        ><span class="hidden group-open:inline">−</span></span
      ></span
    >
  </summary>
</template>
