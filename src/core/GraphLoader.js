export class GraphLoader {
    async load(url) {
        const res = await fetch(url);
        const data = await res.json();
        const nodes = {}, adjacencyList = {};
        data.nodes.forEach(n => { 
            nodes[n.id] = n; 
            adjacencyList[n.id] = []; 
        });
        data.edges.forEach(e => { 
            if (adjacencyList[e.from]) adjacencyList[e.from].push(e); 
        });
        return { nodes, adjacencyList };
    }
}