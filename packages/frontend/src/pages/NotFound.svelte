<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  function handleHome() {
    dispatch('navigate', 'home');
  }
</script>

<div class="not-found">
  <div class="content">
    <h1>404</h1>
    <h2>Página não encontrada</h2>
    <p>A página que você está procurando não existe.</p>
    <button on:click={handleHome}>Voltar para Home</button>
  </div>
</div>

<style>
  .not-found {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 80vh;
    padding: 20px;
    text-align: center;
  }

  .content {
    max-width: 500px;
  }

  h1 {
    font-size: 72px;
    color: #1976d2;
    margin-bottom: 20px;
  }

  h2 {
    font-size: 24px;
    margin-bottom: 10px;
    color: #333;
  }

  p {
    color: #666;
    margin-bottom: 30px;
  }

  button {
    background-color: #1976d2;
    color: white;
    padding: 12px 30px;
    font-size: 16px;
  }

  button:hover {
    background-color: #1565c0;
  }
</style>
