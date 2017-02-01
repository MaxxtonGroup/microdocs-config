node {
    stage('Checkout'){
        deleteDir()
        echo "Checkout git"
        checkout([$class: 'GitSCM', branches: [[name: '*/master']], doGenerateSubmoduleConfigurations: false, submoduleCfg: [], userRemoteConfigs: [[url: 'https://github.com/MaxxtonGroup/microdocs-config', branch: 'master']]])
        stash name: 'src'
    }
    stage('Publish files'){
        //todo
    }
}