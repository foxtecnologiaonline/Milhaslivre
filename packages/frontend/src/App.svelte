<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from './stores/auth';
  import Home from './pages/Home.svelte';
  import Login from './pages/Login.svelte';
  import Register from './pages/Register.svelte';
  import Dashboard from './pages/Dashboard.svelte';
  import NotFound from './pages/NotFound.svelte';

  let currentPage = 'home';
  let isAuthenticated = false;

  onMount(() => {
    authStore.subscribe((value) => {
      isAuthenticated = !!value?.token;
    });
  });

  function navigate(page: string) {
    currentPage = page;
    window.scrollTo(0, 0);
  }
</script>

<nav class="navbar">
  <div class="container">
    <button on:click={() => navigate('home')} class="brand">🏆 Milhas Livre</button>
    <div class="nav-links">
      {#if isAuthenticated}
        <button on:click={() => navigate('dashboard')}>Dashboard</button>
        <button on:click={() => authStore.logout()}>Sair</button>
      {:else}
        <button on:click={() => navigate('login')}>Login</button>
        <button on:click={() => navigate('register')}>Criar Conta</button>
      {/if}
    </div>
  </div>
</nav>

<main class="app-container">
  {#if currentPage === 'home'}
    <Home on:navigate={(e) => navigate(e.detail)} />
  {:else if currentPage === 'login'}
    <Login on:success={() => navigate('dashboard')} on:navigate={(e) => navigate(e.detail)} />
  {:else if currentPage === 'register'}
    <Register on:success={() => navigate('dashboard')} on:navigate={(e) => navigate(e.detail)} />
  {:else if currentPage === 'dashboard'}
    {#if isAuthenticated}
      <Dashboard on:navigate={(e) => navigate(e.detail)} />
    {:else}
      <Login on:success={() => navigate('dashboard')} on:navigate={(e) => navigate(e.detail)} />
    {/if}
  {:else}
    <NotFound on:navigate={(e) => navigate(e.detail)} />
  {/if}
</main>

<style>
  :global(* ) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background-color: #f5f5f5;
    color: #333;
  }

  :global(button) {
    cursor: pointer;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    font-size: 14px;
    transition: all 0.3s ease;
  }

  :global(button:hover) {
    opacity: 0.9;
  }

  .navbar {
    background-color: #fff;
    border-bottom: 1px solid #e0e0e0;
    padding: 1rem 0;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .brand {
    font-size: 20px;
    font-weight: bold;
    color: #1976d2;
    background: none;
    padding: 0;
  }

  .nav-links {
    display: flex;
    gap: 10px;
  }

  .nav-links button {
    background-color: transparent;
    color: #333;
    padding: 8px 16px;
  }

  .nav-links button:hover {
    background-color: #f0f0f0;
  }

  .app-container {
    min-height: calc(100vh - 60px);
  }
</style>
